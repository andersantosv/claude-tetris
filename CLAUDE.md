# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla Tetris implementation using HTML5 Canvas, CSS, and plain JavaScript (ES6+). No dependencies, no build step, no package.json.

## Running the game

There is no build/lint/test tooling. To run:

```bash
open index.html              # macOS, opens directly in browser
python3 -m http.server 8000  # or serve locally, then visit http://localhost:8000
```

## Architecture

Three files, no modules/bundler — `index.html` loads `game.js` directly as a classic script, which reads DOM elements defined in `index.html` and renders onto two `<canvas>` elements (`board` for the play field, `next-canvas` for the next-piece preview).

All game logic lives in `game.js` as top-level functions operating on module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — there are no classes and no state container.

Key mechanics in `game.js`:

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece type locked there.
- **Pieces**: defined in `PIECES` as square matrices. Rotation is done by `rotateCW` (transpose + reverse), not by predefined rotation states.
- **Collision** (`collide`): checks a shape against board bounds and already-locked cells.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until a non-colliding position is found.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row when it exceeds `dropInterval`.
- **Line clearing** (`clearLines`): scans bottom-to-top, splices out full rows and unshifts empty rows at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 points/row dropped, soft drop adds 1 point/row.
- **Level/speed**: level increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece**: `ghostY()` projects the current piece straight down to its landing row; drawn with `globalAlpha = 0.2`.

Flow: `init()` builds the board, seeds `next`, calls `spawn()` (promotes `next` to `current`, generates a new `next`, and triggers `endGame()` if the new piece immediately collides), then starts the `requestAnimationFrame` loop. Keyboard input (`keydown` listener) handles movement, rotation, soft/hard drop, and pause; the restart button re-invokes `init()`.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, `dropInterval` (initial fall speed). If `COLS`/`ROWS`/`BLOCK` change, update the `width`/`height` attributes of `<canvas id="board">` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
