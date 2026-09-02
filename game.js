'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
];

// Paletas por skin (mismo orden de índices que COLORS: 1..8)
const NEON_COLORS = [
  null, '#00e5ff', '#ffee00', '#e040fb', '#00e676',
  '#ff1744', '#2979ff', '#ff9100', '#e0e0e0',
];
const PASTEL_COLORS = [
  null, '#a8e6cf', '#fdffb6', '#d6b3ff', '#c6f0c2',
  '#ffb3ba', '#bae1ff', '#ffd8a8', '#dcdce6',
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const screens = overlay.querySelectorAll('.screen');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelects = [
  document.getElementById('start-level'),
  document.getElementById('start-level-pause'),
];
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const startRecordsEl = document.getElementById('start-records');
const pauseRecordsEl = document.getElementById('pause-records');
const gameoverRecordsEl = document.getElementById('gameover-records');
const nameEntryEl = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const skinSelects = [
  document.getElementById('skin-select'),
  document.getElementById('skin-select-start'),
];

const THEME_STORAGE_KEY = 'tetris-theme';
const START_LEVEL_STORAGE_KEY = 'tetris-start-level';
const RECORDS_STORAGE_KEY = 'tetris-records';
const SKIN_STORAGE_KEY = 'tetris-skin';
const MAX_START_LEVEL = 15;
const MAX_RECORDS = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let menuOpen = false;
let started = false;       // false mientras se muestra la pantalla de inicio (no hay partida)
let startLevel = 1;        // nivel elegido para la PRÓXIMA partida (selector + localStorage)
let activeStartLevel = 1;  // nivel base fijado al arrancar la partida en curso
let combo = 0;             // rachas de piezas consecutivas que limpian líneas
let maxCombo = 0;          // mejor racha de la partida en curso
let lastGame = null;       // resumen de la última partida, para guardar el record

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = activeStartLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  updateHUD();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  currentSkin.draw(context, x, y, colorIndex, size, alpha ?? 1);
}

// --- Funciones de dibujo por skin (una por entrada de SKINS) ---

function drawBlockRetro(context, x, y, ci, size, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha;
  context.fillStyle = currentSkin.colors[ci];
  context.fillRect(px, py, s, s);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, ci, size, alpha) {
  const color = currentSkin.colors[ci];
  const px = x * size + 2, py = y * size + 2, s = size - 4;
  context.globalAlpha = alpha;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  context.fillRect(px, py, s, s); // segunda pasada: refuerza el glow
  context.shadowBlur = 0;         // imprescindible: no contaminar rejilla ni texto
  context.globalAlpha = 1;
}

function pathRoundRect(context, px, py, w, h, r) {
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(px, py, w, h, r);
  } else {
    context.beginPath();
    context.rect(px, py, w, h);
  }
}

function drawBlockPastel(context, x, y, ci, size, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  const r = Math.max(3, size * 0.22);
  context.globalAlpha = alpha;
  context.fillStyle = currentSkin.colors[ci];
  pathRoundRect(context, px, py, s, s, r);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.28)';
  pathRoundRect(context, px, py, s, s * 0.42, r);
  context.fill();
  context.globalAlpha = 1;
}

function drawBlockPixel(context, x, y, ci, size, alpha) {
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha;
  context.fillStyle = currentSkin.colors[ci];
  context.fillRect(px, py, s, s);
  // patrón de textura: tablero 4x4 de píxeles claros/oscuros
  const n = 4, cell = s / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      context.fillStyle = (i + j) % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
      context.fillRect(px + i * cell, py + j * cell, cell, cell);
    }
  }
  // bisel oscuro abajo/derecha
  context.fillStyle = 'rgba(0,0,0,0.30)';
  context.fillRect(px, py + s - 3, s, 3);
  context.fillRect(px + s - 3, py, 3, s);
  context.globalAlpha = 1;
}

const SKINS = {
  retro:  { label: 'Retro',     colors: COLORS,        draw: drawBlockRetro,  boardBg: null,      grid: null },
  neon:   { label: 'Neon',      colors: NEON_COLORS,   draw: drawBlockNeon,   boardBg: '#05050a', grid: '#1c1c38' },
  pastel: { label: 'Pastel',    colors: PASTEL_COLORS, draw: drawBlockPastel, boardBg: null,      grid: null },
  pixel:  { label: 'Pixel art', colors: COLORS,        draw: drawBlockPixel,  boardBg: null,      grid: null },
};
let currentSkin = SKINS.retro;

function drawGrid() {
  const gridLine = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.strokeStyle = gridLine || '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver && current) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function currentScreenName() {
  for (const s of screens) if (!s.hidden) return s.dataset.screen;
  return null;
}

function showScreen(name) {
  for (const s of screens) s.hidden = s.dataset.screen !== name;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  for (const s of screens) s.hidden = true;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY));
    if (parsed && typeof parsed === 'object') {
      const scores = Array.isArray(parsed.scores)
        ? parsed.scores
            .filter(s => s && typeof s === 'object' && Number.isFinite(Number(s.score)))
            .slice(0, MAX_RECORDS)
        : [];
      return {
        scores,
        bestCombo: Number(parsed.bestCombo) || 0,
        maxLines: Number(parsed.maxLines) || 0,
      };
    }
  } catch (_) { /* localStorage no disponible o JSON corrupto */ }
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function saveRecords(data) {
  try { localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

function scoreQualifies(sc) {
  if (sc <= 0) return false;
  const recs = loadRecords();
  if (recs.scores.length < MAX_RECORDS) return true;
  return sc > recs.scores[recs.scores.length - 1].score;
}

function addRecord(name, game) {
  const recs = loadRecords();
  const row = {
    name: (name && name.trim()) || 'Anónimo',
    score: game.score,
    lines: game.lines,
    level: game.level,
    combo: game.combo,
    date: new Date().toISOString().slice(0, 10),
  };
  recs.scores.push(row);
  recs.scores.sort((a, b) => b.score - a.score);
  recs.scores = recs.scores.slice(0, MAX_RECORDS);
  recs.bestCombo = Math.max(recs.bestCombo, game.combo);
  recs.maxLines = Math.max(recs.maxLines, game.lines);
  saveRecords(recs);
  return recs.scores.indexOf(row);
}

function renderRecords(container, highlightIndex) {
  if (!container) return;
  const recs = loadRecords();
  let html = '';
  if (recs.scores.length === 0) {
    html += '<p class="records-empty">Sin records todavía</p>';
  } else {
    html += '<ol class="records-list">';
    recs.scores.forEach((s, i) => {
      const cls = i === highlightIndex ? ' class="highlight"' : '';
      html += `<li${cls}><span class="rec-name">${escapeHtml(s.name)}</span>`
        + `<span class="rec-score">${Number(s.score).toLocaleString()}</span></li>`;
    });
    html += '</ol>';
  }
  html += `<p class="records-stats">Mejor combo: ${recs.bestCombo} &middot; Máx. líneas: ${recs.maxLines}</p>`;
  container.innerHTML = html;
}

function endGame() {
  gameOver = true;
  menuOpen = false;
  cancelAnimationFrame(animId);
  draw();
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  lastGame = { score, lines, level, combo: maxCombo };

  // Actualiza combo/líneas máximas aunque la puntuación no entre en el top.
  const recs = loadRecords();
  recs.bestCombo = Math.max(recs.bestCombo, maxCombo);
  recs.maxLines = Math.max(recs.maxLines, lines);
  saveRecords(recs);

  const qualifies = scoreQualifies(score);
  nameEntryEl.hidden = !qualifies;
  if (qualifies) playerNameInput.value = '';
  renderRecords(gameoverRecordsEl, -1);
  showScreen('gameover');
  if (qualifies) playerNameInput.focus();
}

function openPauseMenu() {
  if (gameOver || paused) return;
  paused = true;
  menuOpen = true;
  cancelAnimationFrame(animId);
  renderRecords(pauseRecordsEl, -1);
  showScreen('pause');
}

function resumeGame() {
  if (gameOver) return;
  paused = false;
  menuOpen = false;
  hideOverlay();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else openPauseMenu();
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  combo = 0;
  maxCombo = 0;
  activeStartLevel = startLevel;
  level = activeStartLevel;
  started = true;
  paused = false;
  menuOpen = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlay();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started) return; // pantalla de inicio: sin control por teclado
  // Si el foco está en un control de formulario (selectores de skin/nivel del
  // panel, campo de nombre...) las teclas son suyas, no del juego.
  const focusTag = document.activeElement && document.activeElement.tagName;
  if (focusTag === 'SELECT' || focusTag === 'INPUT') return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (menuOpen && currentScreenName() === 'pause-controls') showScreen('pause');
    else if (!gameOver) togglePause();
    return;
  }
  if (menuOpen || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', () => showScreen('pause-controls'));
controlsBackBtn.addEventListener('click', () => showScreen('pause'));
playBtn.addEventListener('click', init);

saveScoreBtn.addEventListener('click', () => {
  if (!lastGame) return;
  const idx = addRecord(playerNameInput.value, lastGame);
  lastGame = null;
  nameEntryEl.hidden = true;
  renderRecords(gameoverRecordsEl, idx);
});

resetRecordsBtn.addEventListener('click', () => {
  if (!window.confirm('¿Borrar todos los records?')) return;
  saveRecords({ scores: [], bestCombo: 0, maxLines: 0 });
  renderRecords(startRecordsEl, -1);
});

function populateStartLevelSelect() {
  for (const sel of startLevelSelects) {
    for (let i = 1; i <= MAX_START_LEVEL; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      sel.appendChild(opt);
    }
  }
}

function syncStartLevelSelects() {
  for (const sel of startLevelSelects) sel.value = String(startLevel);
}

function initStartLevel() {
  let stored = NaN;
  try { stored = parseInt(localStorage.getItem(START_LEVEL_STORAGE_KEY), 10); } catch (_) {}
  startLevel = Number.isInteger(stored) && stored >= 1 && stored <= MAX_START_LEVEL ? stored : 1;
  syncStartLevelSelects();
}

for (const sel of startLevelSelects) {
  sel.addEventListener('change', () => {
    startLevel = parseInt(sel.value, 10) || 1;
    try { localStorage.setItem(START_LEVEL_STORAGE_KEY, String(startLevel)); } catch (_) {}
    syncStartLevelSelects();
  });
}

function populateSkinSelects() {
  for (const sel of skinSelects) {
    for (const [key, skin] of Object.entries(SKINS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = skin.label;
      sel.appendChild(opt);
    }
  }
}

// Aplica la skin: paleta + función de draw (vía currentSkin) y, para skins
// con tablero propio, sobrescribe --board-bg / --grid-line en document.body.
function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = SKINS[name];
  const s = document.body.style;
  if (currentSkin.boardBg) s.setProperty('--board-bg', currentSkin.boardBg);
  else s.removeProperty('--board-bg');
  if (currentSkin.grid) s.setProperty('--grid-line', currentSkin.grid);
  else s.removeProperty('--grid-line');
  for (const sel of skinSelects) sel.value = name;
}

function initSkin() {
  let name = 'retro';
  try { name = localStorage.getItem(SKIN_STORAGE_KEY) || 'retro'; } catch (_) {}
  applySkin(name);
}

for (const sel of skinSelects) {
  sel.addEventListener('change', () => {
    const name = SKINS[sel.value] ? sel.value : 'retro';
    applySkin(name);
    try { localStorage.setItem(SKIN_STORAGE_KEY, name); } catch (_) {}
    draw();
    if (next) drawNext();
  });
}

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Activar modo oscuro' : 'Activar modo claro');
  themeToggle.textContent = isLight ? '☀️' : '🌙';
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light');
}

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-theme');
  applyTheme(isLight);
  localStorage.setItem(THEME_STORAGE_KEY, isLight ? 'light' : 'dark');
  draw();
});

function showStartScreen() {
  board = createBoard();
  started = false;
  paused = false;
  menuOpen = false;
  gameOver = false;
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  cancelAnimationFrame(animId);
  draw();
  updateHUD();
  renderRecords(startRecordsEl, -1);
  showScreen('start');
}

populateStartLevelSelect();
initStartLevel();
populateSkinSelects();
initSkin();
initTheme();
showStartScreen();
