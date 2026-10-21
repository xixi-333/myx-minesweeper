(() => {
  const DIFFICULTIES = {
    beginner:     { rows: 9,  cols: 9,  mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert:       { rows: 16, cols: 30, mines: 99 },
  };

  const boardEl = document.getElementById('board');
  const mineCounterEl = document.getElementById('mine-counter');
  const timerEl = document.getElementById('timer');
  const resetBtn = document.getElementById('reset-btn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const overlayBtn = document.getElementById('overlay-btn');
  const diffButtons = document.querySelectorAll('.diff-btn');

  let rows, cols, mineCount;
  let grid;            // grid[r][c] = { mine, revealed, flagged, question, adjacent }
  let firstClickDone;
  let flagsPlaced;
  let revealedCount;
  let gameOver;
  let timerHandle;
  let seconds;
  let currentDiff = 'beginner';

  function pad3(n) {
    const sign = n < 0 ? '-' : '';
    const v = Math.min(Math.abs(n), 999).toString().padStart(sign ? 2 : 3, '0');
    return sign + v;
  }

  function setDifficulty(diff) {
    currentDiff = diff;
    const cfg = DIFFICULTIES[diff];
    rows = cfg.rows;
    cols = cfg.cols;
    mineCount = cfg.mines;
    diffButtons.forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
    startNewGame();
  }

  function startNewGame() {
    stopTimer();
    seconds = 0;
    timerEl.textContent = pad3(0);
    firstClickDone = false;
    gameOver = false;
    flagsPlaced = 0;
    revealedCount = 0;
    mineCounterEl.textContent = pad3(mineCount);
    resetBtn.textContent = '🙂';
    overlay.classList.add('hidden');

    grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ mine: false, revealed: false, flagged: false, question: false, adjacent: 0 });
      }
      grid.push(row);
    }

    buildBoard();
  }

  function buildBoard() {
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 26px)`;
    boardEl.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', onLeftClick);
        cell.addEventListener('dblclick', onDoubleClick);
        cell.addEventListener('contextmenu', onRightClick);
        cell.addEventListener('mousedown', (e) => {
          if (!gameOver && e.button === 0) resetBtn.textContent = '😮';
        });
        boardEl.appendChild(cell);
      }
    }
    window.addEventListener('mouseup', () => {
      if (!gameOver) resetBtn.textContent = '🙂';
    });
  }

  function cellEl(r, c) {
    return boardEl.children[r * cols + c];
  }

  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  function placeMines(excludeR, excludeC) {
    const forbidden = new Set();
    forEachNeighbor(excludeR, excludeC, (r, c) => forbidden.add(r + ',' + c));
    forbidden.add(excludeR + ',' + excludeC);

    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const key = r + ',' + c;
      if (forbidden.has(key) || grid[r][c].mine) continue;
      grid[r][c].mine = true;
      placed++;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let n = 0;
        forEachNeighbor(r, c, (nr, nc) => { if (grid[nr][nc].mine) n++; });
        grid[r][c].adjacent = n;
      }
    }
  }

  function startTimer() {
    if (timerHandle) return;
    timerHandle = setInterval(() => {
      seconds++;
      timerEl.textContent = pad3(seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
  }

  function onLeftClick(e) {
    if (e.button !== 0) return;
    if (gameOver) return;
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    const cell = grid[r][c];
    if (cell.flagged || cell.question) return;

    if (!firstClickDone) {
      placeMines(r, c);
      firstClickDone = true;
      startTimer();
    }

    if (cell.mine) {
      revealAllMines(r, c);
      endGame(false);
      return;
    }

    reveal(r, c);
    checkWin();
  }

  function reveal(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged || cell.question) return;
    cell.revealed = true;
    revealedCount++;
    const el = cellEl(r, c);
    el.classList.add('revealed');
    if (cell.adjacent > 0) {
      el.textContent = cell.adjacent;
      el.dataset.n = cell.adjacent;
    } else {
      forEachNeighbor(r, c, (nr, nc) => reveal(nr, nc));
    }
  }

  function onRightClick(e) {
    e.preventDefault();
    if (gameOver) return;
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    const cell = grid[r][c];
    if (cell.revealed) return;
    const el = e.currentTarget;

    if (!cell.flagged && !cell.question) {
      cell.flagged = true;
      flagsPlaced++;
      el.textContent = '🚩';
    } else if (cell.flagged) {
      cell.flagged = false;
      cell.question = true;
      flagsPlaced--;
      el.textContent = '❓';
    } else {
      cell.question = false;
      el.textContent = '';
    }
    mineCounterEl.textContent = pad3(mineCount - flagsPlaced);
  }

  function onDoubleClick(e) {
    if (gameOver) return;
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    const cell = grid[r][c];
    if (!cell.revealed || cell.adjacent === 0) return;

    let flaggedNeighbors = 0;
    forEachNeighbor(r, c, (nr, nc) => { if (grid[nr][nc].flagged) flaggedNeighbors++; });
    if (flaggedNeighbors !== cell.adjacent) return;

    let hitMine = false;
    forEachNeighbor(r, c, (nr, nc) => {
      const n = grid[nr][nc];
      if (!n.flagged && !n.revealed) {
        if (n.mine) {
          hitMine = true;
          revealAllMines(nr, nc);
        } else {
          reveal(nr, nc);
        }
      }
    });

    if (hitMine) {
      endGame(false);
    } else {
      checkWin();
    }
  }

  function revealAllMines(hitR, hitC) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const el = cellEl(r, c);
        if (cell.mine && !cell.flagged) {
          el.classList.add('mine', 'revealed');
          el.textContent = '💣';
          if (r === hitR && c === hitC) el.classList.add('mine-hit');
        } else if (!cell.mine && cell.flagged) {
          el.textContent = '❌';
        }
      }
    }
  }

  function checkWin() {
    if (revealedCount === rows * cols - mineCount) {
      endGame(true);
    }
  }

  function endGame(win) {
    gameOver = true;
    stopTimer();
    resetBtn.textContent = win ? '😎' : '😵';
    overlay.classList.remove('hidden');
    if (win) {
      overlayTitle.textContent = '扫雷成功！';
      overlayMsg.textContent = `用时 ${seconds} 秒`;
    } else {
      overlayTitle.textContent = '踩雷了';
      overlayMsg.textContent = '再试一次吧';
    }
  }

  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
  });

  resetBtn.addEventListener('click', startNewGame);
  overlayBtn.addEventListener('click', startNewGame);

  setDifficulty('beginner');
})();
