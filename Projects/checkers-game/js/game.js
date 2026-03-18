// Checkers — Game UI & orchestration

// ── Persistent state (survives page refresh) ──────────────────────────────────
let playerScore = parseInt(localStorage.getItem('checkers_playerScore') || '0', 10);
let aiScore     = parseInt(localStorage.getItem('checkers_aiScore')     || '0', 10);
const ai = new CheckersAI();

// ── Per-game state ────────────────────────────────────────────────────────────
let engine        = null;
let playerColor   = 'red';
let pendingColor  = 'red';
let isAIThinking  = false;
let selectedSq    = null;
let legalMoves    = []; // legal moves for the selected piece
let allLegalMoves = []; // all legal moves for the current player (for mandatory-capture highlight)

// Mid-jump state — set while a multi-capture sequence is in progress
// { origFromRow, origFromCol, currentRow, currentCol, captures: [{row,col,piece}] }
let midJump = null;

// ── Screen management ─────────────────────────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ── Start flow ────────────────────────────────────────────────────────────────

function selectColor(color) {
    pendingColor = color;
    document.getElementById('color-section').classList.add('hidden');
    document.getElementById('difficulty-section').classList.remove('hidden');
}

function backToColorSelect() {
    document.getElementById('difficulty-section').classList.add('hidden');
    document.getElementById('color-section').classList.remove('hidden');
}

function startGame(level) {
    ai.setLevel(level);
    playerColor  = pendingColor;
    engine       = new CheckersEngine();
    isAIThinking = false;
    selectedSq   = null;
    legalMoves   = [];
    midJump      = null;

    document.getElementById('you-label').textContent =
        `You (${playerColor === 'red' ? 'Red' : 'Black'})`;

    showScreen('game-screen');
    renderBoard();
    updateUI();

    if (playerColor === 'black') {
        // AI (red) moves first
        setTimeout(triggerAIMove, 600);
    }
}

// ── Board rendering ───────────────────────────────────────────────────────────

function renderBoard() {
    const boardEl = document.getElementById('checkers-board');
    boardEl.innerHTML = '';

    // Red always at bottom → flip board when player is black
    const flipped = playerColor === 'black';

    // Rank labels
    const rankEl = document.getElementById('rank-labels');
    rankEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const d = document.createElement('div');
        d.className = 'coord';
        d.textContent = flipped ? (i + 1) : (8 - i);
        rankEl.appendChild(d);
    }

    // File labels
    const fileEl = document.getElementById('file-labels');
    fileEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const d = document.createElement('div');
        d.className = 'coord';
        d.textContent = String.fromCharCode(97 + (flipped ? 7 - i : i));
        fileEl.appendChild(d);
    }

    allLegalMoves = engine.getAllLegalMoves(engine.currentTurn);
    // Don't show mandatory-capture glow mid-sequence — the player is already jumping
    const mustCapturePieces = (!midJump && engine.hasMandatoryCapture(engine.currentTurn))
        ? new Set(allLegalMoves.map(m => `${m.fromRow},${m.fromCol}`))
        : new Set();

    for (let dr = 0; dr < 8; dr++) {
        for (let dc = 0; dc < 8; dc++) {
            const row = flipped ? 7 - dr : dr;
            const col = flipped ? 7 - dc : dc;
            const isDark = (row + col) % 2 === 1;

            const sq = document.createElement('div');
            sq.className = `square ${isDark ? 'dark' : 'light'}`;
            sq.dataset.row = row;
            sq.dataset.col = col;

            if (isDark) sq.addEventListener('click', () => onSquareClick(row, col));

            const piece = engine.board[row][col];
            if (piece) {
                const el = document.createElement('div');
                el.className = `checker piece-${piece.color}${piece.type === 'king' ? ' king' : ''}`;

                // Glow on pieces that MUST capture this turn
                if (engine.currentTurn === playerColor && mustCapturePieces.has(`${row},${col}`)) {
                    el.classList.add('must-capture');
                }
                if (piece.type === 'king') {
                    const crown = document.createElement('span');
                    crown.className = 'crown';
                    crown.textContent = '♛';
                    el.appendChild(crown);
                }
                sq.appendChild(el);
            }

            boardEl.appendChild(sq);
        }
    }
}

function getSq(row, col) {
    return document.querySelector(`#checkers-board .square[data-row="${row}"][data-col="${col}"]`);
}

// ── Player interaction ────────────────────────────────────────────────────────

function onSquareClick(row, col) {
    if (isAIThinking) return;
    if (engine.gameStatus === 'gameover') return;

    // ── Mid-jump: player must continue capturing, no other action allowed ──
    if (midJump) {
        const matched = legalMoves.find(m => m.toRow === row && m.toCol === col);
        if (matched) {
            clearHighlights();
            doJumpStep(matched);
        }
        return;
    }

    if (engine.currentTurn !== playerColor) return;

    const piece   = engine.board[row][col];
    const matched = legalMoves.find(m => m.toRow === row && m.toCol === col);

    // Clicked a highlighted destination
    if (matched) {
        clearHighlights();
        if (matched.isJump) {
            doJumpStep(matched);
        } else {
            executeSimpleMove(matched);
        }
        return;
    }

    // Clicked own piece — select it
    if (piece && piece.color === playerColor) {
        clearHighlights();
        const moves = engine.getLegalMovesFrom(row, col);
        if (moves.length === 0) return; // can't move this piece (mandatory capture elsewhere)

        selectedSq = { row, col };
        getSq(row, col).classList.add('selected');
        legalMoves = moves;
        for (const m of moves) getSq(m.toRow, m.toCol).classList.add(m.isJump ? 'jump-sq' : 'valid-sq');
        return;
    }

    clearHighlights();
}

function clearHighlights() {
    selectedSq = null;
    legalMoves = [];
    document.querySelectorAll('#checkers-board .square').forEach(sq => {
        sq.classList.remove('selected', 'valid-sq', 'jump-sq');
    });
}

// ── Simple (non-capture) move ─────────────────────────────────────────────────

function executeSimpleMove(move) {
    engine.makeMove(move);
    midJump      = null;
    isAIThinking = true;
    renderBoard();
    updateUI();
    if (engine.gameStatus === 'gameover') {
        isAIThinking = false;
        setTimeout(handleGameEnd, 800);
        return;
    }
    triggerAIMove();
}

// ── Step-by-step jump execution ───────────────────────────────────────────────

function doJumpStep(move) {
    const result = engine.applySingleJump(move.fromRow, move.fromCol, move.toRow, move.toCol);

    // Accumulate jump state
    if (!midJump) {
        midJump = {
            origFromRow: move.fromRow, origFromCol: move.fromCol,
            pieceColor: playerColor,
            captures: []
        };
    }
    midJump.captures.push({ row: result.captureRow, col: result.captureCol, piece: result.capturedPiece });
    midJump.currentRow = move.toRow;
    midJump.currentCol = move.toCol;

    // If this jump crowned the piece, the turn ends immediately
    if (result.becomesKing) {
        finalizeJumpSequence(move.toRow, move.toCol);
        return;
    }

    // Check for further jumps from the new position
    const nextJumps = engine.getSingleJumpsFrom(move.toRow, move.toCol);
    if (nextJumps.length > 0) {
        // Re-render board showing piece at new position, then highlight next options
        renderBoard();
        updateUI();
        selectedSq = { row: move.toRow, col: move.toCol };
        legalMoves = nextJumps;
        getSq(move.toRow, move.toCol).classList.add('selected');
        for (const m of nextJumps) getSq(m.toRow, m.toCol).classList.add('jump-sq');
    } else {
        finalizeJumpSequence(move.toRow, move.toCol);
    }
}

function finalizeJumpSequence(toRow, toCol) {
    // Record the complete sequence as a single history entry
    engine.moveHistory.push({
        fromRow: midJump.origFromRow, fromCol: midJump.origFromCol,
        toRow, toCol,
        captures: midJump.captures,
        isJump: true,
        becomesKing: engine.board[toRow][toCol]?.type === 'king',
        piece: { type: engine.board[toRow][toCol]?.type, color: midJump.pieceColor }
    });

    midJump      = null;
    isAIThinking = true;
    engine.finalizeTurn(playerColor);
    renderBoard();
    updateUI();

    if (engine.gameStatus === 'gameover') {
        isAIThinking = false;
        setTimeout(handleGameEnd, 800);
        return;
    }
    triggerAIMove();
}

// ── AI move ───────────────────────────────────────────────────────────────────

function triggerAIMove() {
    if (engine.gameStatus === 'gameover') { isAIThinking = false; return; }

    isAIThinking = true;
    setStatus('AI is thinking…');

    setTimeout(() => {
        const aiColor = playerColor === 'red' ? 'black' : 'red';
        const move = ai.getBestMove(engine, aiColor);
        if (move) engine.makeMove(move);
        isAIThinking = false;
        renderBoard();
        updateUI();
        if (engine.gameStatus === 'gameover') setTimeout(handleGameEnd, 800);
    }, 50);
}

// ── UI updates ────────────────────────────────────────────────────────────────

function updateUI() {
    updateStatus();
    updateScores();
    updateAIPanel();
    updateMoveHistory();
    updateCaptured();
}

function setStatus(text) {
    document.getElementById('status-text').textContent = text;
}

function updateStatus() {
    if (engine.gameStatus === 'gameover') {
        setStatus(`${engine.winner === 'red' ? 'Red' : 'Black'} wins!`);
        return;
    }
    if (midJump) {
        setStatus('Keep jumping! Select your next capture.');
        return;
    }
    const isYourTurn = engine.currentTurn === playerColor;
    const turnName   = engine.currentTurn === 'red' ? 'Red' : 'Black';
    const capture    = engine.hasMandatoryCapture(engine.currentTurn) ? ' — must capture!' : '';
    setStatus(`${turnName}'s turn${isYourTurn ? ' (Your turn)' : ''}${capture}`);
}

function updateScores() {
    document.getElementById('score-you').textContent      = playerScore;
    document.getElementById('score-ai').textContent       = aiScore;
    document.getElementById('start-score-you').textContent = playerScore;
    document.getElementById('start-score-ai').textContent  = aiScore;
}

function updateAIPanel() {
    const level = ai.getLevel();
    const name  = ai.getLevelName();
    document.getElementById('ai-level-name').textContent       = name;
    document.getElementById('ai-games-count').textContent      = ai.gamesPlayed;
    document.getElementById('ai-level-bar-fill').style.width   = `${(level / 5) * 100}%`;
}

function updateMoveHistory() {
    const el = document.getElementById('move-history');
    el.innerHTML = '';
    const history = engine.moveHistory;
    for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'history-row';
        const num = document.createElement('span');
        num.className = 'move-num';
        num.textContent = `${Math.floor(i / 2) + 1}.`;
        const r = document.createElement('span');
        r.textContent = formatMove(history[i]);
        const b = document.createElement('span');
        if (history[i + 1]) b.textContent = formatMove(history[i + 1]);
        row.append(num, r, b);
        el.appendChild(row);
    }
    el.scrollTop = el.scrollHeight;
}

function formatMove(m) {
    if (!m) return '';
    const f = 'abcdefgh';
    const from = `${f[m.fromCol]}${8 - m.fromRow}`;
    const to   = `${f[m.toCol]}${8 - m.toRow}`;
    let str = m.isJump ? `${from}×${to}` : `${from}-${to}`;
    if (m.becomesKing) str += '♛';
    return str;
}

function updateCaptured() {
    const byPlayer = [], byAI = [];
    for (const m of engine.moveHistory) {
        for (const cap of m.captures) {
            if (m.piece.color === playerColor) byPlayer.push(cap.piece);
            else byAI.push(cap.piece);
        }
    }
    const render = (pieces) => pieces.map(p =>
        `<span class="captured-checker piece-${p.color}${p.type === 'king' ? ' king' : ''}"></span>`
    ).join('');
    document.getElementById('captured-by-player').innerHTML = render(byPlayer);
    document.getElementById('captured-by-ai').innerHTML     = render(byAI);
}

// ── Game end ──────────────────────────────────────────────────────────────────

function handleGameEnd() {
    ai.onGameComplete();

    let icon, title, msg;
    if (engine.winner === playerColor) {
        playerScore++;
        localStorage.setItem('checkers_playerScore', playerScore);
        icon = '🏆'; title = 'You Win!'; msg = 'Congratulations! You defeated the AI.';
    } else {
        aiScore++;
        localStorage.setItem('checkers_aiScore', aiScore);
        icon = '🤖'; title = 'AI Wins'; msg = 'The AI won this round. Try again!';
    }

    document.getElementById('result-icon').textContent      = icon;
    document.getElementById('result-title').textContent     = title;
    document.getElementById('result-msg').textContent       = msg;
    document.getElementById('result-score-you').textContent = playerScore;
    document.getElementById('result-score-ai').textContent  = aiScore;
    document.getElementById('result-level-msg').textContent =
        `Difficulty: ${ai.getLevelName()} · Games played: ${ai.gamesPlayed}`;

    showScreen('result-screen');
}

// ── Button handlers ───────────────────────────────────────────────────────────

function resignGame() {
    if (!engine || engine.gameStatus === 'gameover') return;
    engine.gameStatus = 'gameover';
    engine.winner     = playerColor === 'red' ? 'black' : 'red';
    handleGameEnd();
}

function offerDraw() {
    if (!engine || engine.gameStatus !== 'playing') return;
    if (confirm('Accept draw? (The AI always accepts.)')) {
        engine.gameStatus = 'gameover';
        engine.winner     = null;
        // Draw — no score change
        document.getElementById('result-icon').textContent      = '🤝';
        document.getElementById('result-title').textContent     = 'Draw!';
        document.getElementById('result-msg').textContent       = 'The game ended in a draw.';
        document.getElementById('result-score-you').textContent = playerScore;
        document.getElementById('result-score-ai').textContent  = aiScore;
        document.getElementById('result-level-msg').textContent =
            `Difficulty: ${ai.getLevelName()} · Games played: ${ai.gamesPlayed}`;
        ai.onGameComplete();
        showScreen('result-screen');
    }
}

function playAgain() {
    pendingColor = playerColor;
    startGame(ai.getLevel());
}

function switchSides() { backToMenu(); }

function backToMenu() {
    document.getElementById('difficulty-section').classList.add('hidden');
    document.getElementById('color-section').classList.remove('hidden');
    updateScores();
    updateAIPanel();
    showScreen('start-screen');
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateScores();
