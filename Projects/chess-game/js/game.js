// Game UI & orchestration

const SYMBOLS = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

// Persistent state across games
let playerScore = 0;
let aiScore = 0;
const ai = new ChessAI();

// Per-game state
let engine = null;
let playerColor = 'white';
let isAIThinking = false;
let selectedSq = null;
let highlightedMoves = [];
let pendingPromotion = null;

// ─── Screen management ────────────────────────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ─── Game start ───────────────────────────────────────────────────────────────

function startGame(color) {
    playerColor = color;
    engine = new ChessEngine();
    isAIThinking = false;
    selectedSq = null;
    highlightedMoves = [];
    pendingPromotion = null;

    document.getElementById('you-label').textContent = `You (${color === 'white' ? 'White' : 'Black'})`;
    showScreen('game-screen');
    renderBoard();
    updateUI();

    if (playerColor === 'black') {
        // AI moves first as white
        setTimeout(triggerAIMove, 600);
    }
}

// ─── Board rendering ──────────────────────────────────────────────────────────

function renderBoard() {
    const boardEl = document.getElementById('chess-board');
    boardEl.innerHTML = '';

    const flipped = playerColor === 'black';

    // Rank labels (left side)
    const rankEl = document.getElementById('rank-labels');
    rankEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const label = document.createElement('div');
        label.className = 'coord';
        label.textContent = flipped ? (i + 1) : (8 - i);
        rankEl.appendChild(label);
    }

    // File labels (bottom)
    const fileEl = document.getElementById('file-labels');
    fileEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const label = document.createElement('div');
        label.className = 'coord';
        label.textContent = String.fromCharCode(97 + (flipped ? 7 - i : i));
        fileEl.appendChild(label);
    }

    for (let dr = 0; dr < 8; dr++) {
        for (let dc = 0; dc < 8; dc++) {
            const row = flipped ? 7 - dr : dr;
            const col = flipped ? 7 - dc : dc;

            const sq = document.createElement('div');
            sq.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            sq.dataset.row = row;
            sq.dataset.col = col;
            sq.addEventListener('click', () => onSquareClick(row, col));

            const piece = engine.board[row][col];
            if (piece) {
                const span = document.createElement('span');
                span.className = `piece piece-${piece.color}`;
                span.textContent = SYMBOLS[piece.color][piece.type];
                sq.appendChild(span);
            }

            boardEl.appendChild(sq);
        }
    }
}

function getSq(row, col) {
    return document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
}

// ─── Player interaction ───────────────────────────────────────────────────────

function onSquareClick(row, col) {
    if (isAIThinking || pendingPromotion) return;
    if (engine.currentTurn !== playerColor) return;
    if (engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') return;

    const piece = engine.board[row][col];
    const matchedMove = highlightedMoves.find(m => m.row === row && m.col === col);

    // Clicked a highlighted destination square — execute the move
    if (matchedMove) {
        const from = selectedSq;
        clearHighlights();
        if (matchedMove.special === 'promotion') {
            pendingPromotion = { fromRow: from.row, fromCol: from.col, move: matchedMove };
            showPromotionModal(playerColor);
        } else {
            executePlayerMove(from.row, from.col, matchedMove);
        }
        return;
    }

    // Clicked own piece — select it
    if (piece && piece.color === playerColor) {
        clearHighlights();
        selectedSq = { row, col };
        getSq(row, col).classList.add('selected');

        highlightedMoves = engine.getLegalMoves(row, col);
        for (const m of highlightedMoves) {
            const el = getSq(m.row, m.col);
            el.classList.add(engine.board[m.row][m.col] ? 'capture-sq' : 'valid-sq');
        }
        return;
    }

    // Clicked elsewhere — deselect
    clearHighlights();
}

function clearHighlights() {
    selectedSq = null;
    highlightedMoves = [];
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'valid-sq', 'capture-sq', 'in-check');
    });
}

function executePlayerMove(fromRow, fromCol, move, promotionPiece = 'queen') {
    engine.makeMove(fromRow, fromCol, move, promotionPiece);
    isAIThinking = true; // block player input immediately — no gap before AI starts
    renderBoard();
    updateUI();

    if (engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') {
        isAIThinking = false;
        setTimeout(handleGameEnd, 800);
        return;
    }
    triggerAIMove(); // already has its own 50ms internal delay for UI paint
}

// ─── Promotion ────────────────────────────────────────────────────────────────

function showPromotionModal(color) {
    const modal = document.getElementById('promo-modal');
    const container = document.getElementById('promo-choices');
    container.innerHTML = '';
    for (const type of ['queen', 'rook', 'bishop', 'knight']) {
        const btn = document.createElement('button');
        btn.className = 'promo-btn';
        btn.title = type.charAt(0).toUpperCase() + type.slice(1);
        btn.innerHTML = `<span class="piece piece-${color}">${SYMBOLS[color][type]}</span><span>${btn.title}</span>`;
        btn.onclick = () => {
            modal.classList.add('hidden');
            const { fromRow, fromCol, move } = pendingPromotion;
            pendingPromotion = null;
            executePlayerMove(fromRow, fromCol, move, type);
        };
        container.appendChild(btn);
    }
    modal.classList.remove('hidden');
}

// ─── AI move ──────────────────────────────────────────────────────────────────

function triggerAIMove() {
    if (engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') return;

    isAIThinking = true;
    setStatus('AI is thinking…');

    // Use setTimeout to let the UI paint the "thinking" status
    setTimeout(() => {
        const aiColor = playerColor === 'white' ? 'black' : 'white';
        const move = ai.getBestMove(engine, aiColor);
        if (move) engine.makeMove(move.fromRow, move.fromCol, move);
        isAIThinking = false;
        renderBoard();
        updateUI();
        if (engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') {
            setTimeout(handleGameEnd, 800);
        }
    }, 50);
}

// ─── UI updates ───────────────────────────────────────────────────────────────

function updateUI() {
    updateStatus();
    updateScores();
    updateAIPanel();
    updateMoveHistory();
    updateCaptured();

    if (engine.gameStatus === 'check') {
        markKingInCheck(engine.currentTurn);
    }
}

function setStatus(text) {
    document.getElementById('status-text').textContent = text;
}

function updateStatus() {
    const turn = engine.currentTurn === 'white' ? 'White' : 'Black';
    const you = engine.currentTurn === playerColor;
    switch (engine.gameStatus) {
        case 'playing':  setStatus(`${turn}'s turn${you ? ' (Your turn)' : ''}`); break;
        case 'check':    setStatus(`${turn} is in CHECK!`); break;
        case 'checkmate':setStatus(`Checkmate! ${engine.winner === 'white' ? 'White' : 'Black'} wins!`); break;
        case 'stalemate':setStatus('Stalemate — Draw!'); break;
    }
}

function updateScores() {
    document.getElementById('score-you').textContent = playerScore;
    document.getElementById('score-ai').textContent  = aiScore;
    // start screen scores
    document.getElementById('start-score-you').textContent = playerScore;
    document.getElementById('start-score-ai').textContent  = aiScore;
}

function updateAIPanel() {
    const level = ai.getLevel();
    const name  = ai.getLevelName();
    document.getElementById('ai-level-name').textContent  = name;
    document.getElementById('ai-games-count').textContent = ai.gamesPlayed;
    document.getElementById('ai-level-bar-fill').style.width = `${(level / 5) * 100}%`;
    document.getElementById('start-ai-level').textContent = name;
}

function markKingInCheck(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (engine.board[r][c]?.type === 'king' && engine.board[r][c]?.color === color) {
                const el = getSq(r, c);
                if (el) el.classList.add('in-check');
                return;
            }
        }
    }
}

function updateMoveHistory() {
    const el = document.getElementById('move-history');
    el.innerHTML = '';
    const history = engine.moveHistory;
    for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'history-row';
        const num  = document.createElement('span');
        num.className = 'move-num';
        num.textContent = `${Math.floor(i / 2) + 1}.`;
        const w = document.createElement('span');
        w.textContent = formatMove(history[i]);
        const b = document.createElement('span');
        if (history[i + 1]) b.textContent = formatMove(history[i + 1]);
        row.append(num, w, b);
        el.appendChild(row);
    }
    el.scrollTop = el.scrollHeight;
}

function formatMove(m) {
    if (!m) return '';
    if (m.special === 'castleKingside')  return 'O-O';
    if (m.special === 'castleQueenside') return 'O-O-O';
    const files = 'abcdefgh';
    const prefix = m.piece.type === 'pawn' ? '' : m.piece.type[0].toUpperCase();
    const capture = m.capturedPiece ? 'x' : '-';
    const suffix  = m.special === 'promotion' ? '=Q' : '';
    return `${prefix}${files[m.fromCol]}${8 - m.fromRow}${capture}${files[m.toCol]}${8 - m.toRow}${suffix}`;
}

function updateCaptured() {
    const byPlayer = [], byAI = [];
    for (const m of engine.moveHistory) {
        if (!m.capturedPiece) continue;
        if (m.piece.color === playerColor) byPlayer.push(m.capturedPiece);
        else byAI.push(m.capturedPiece);
    }
    document.getElementById('captured-by-player').textContent = byPlayer.map(p => SYMBOLS[p.color][p.type]).join('');
    document.getElementById('captured-by-ai').textContent      = byAI.map(p => SYMBOLS[p.color][p.type]).join('');
}

// ─── Game end ─────────────────────────────────────────────────────────────────

function handleGameEnd() {
    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const prevLevel = ai.getLevel();
    ai.onGameComplete();
    const newLevel = ai.getLevel();

    let icon, title, msg;
    if (engine.gameStatus === 'checkmate') {
        if (engine.winner === playerColor) {
            playerScore++;
            icon = '🏆'; title = 'You Win!'; msg = 'Congratulations! You defeated the AI.';
        } else {
            aiScore++;
            icon = '🤖'; title = 'AI Wins'; msg = 'The AI won this round. Try again!';
        }
    } else {
        icon = '🤝'; title = 'Draw!'; msg = 'The game ended in a stalemate.';
    }

    document.getElementById('result-icon').textContent    = icon;
    document.getElementById('result-title').textContent   = title;
    document.getElementById('result-msg').textContent     = msg;
    document.getElementById('result-score-you').textContent = playerScore;
    document.getElementById('result-score-ai').textContent  = aiScore;

    const levelMsg = newLevel > prevLevel
        ? `AI levelled up to ${ai.getLevelName()}! The next game will be harder.`
        : `AI is currently ${ai.getLevelName()} level (${ai.gamesPlayed} games played).`;
    document.getElementById('result-level-msg').textContent = levelMsg;

    showScreen('result-screen');
}

// ─── Button handlers ──────────────────────────────────────────────────────────

function resignGame() {
    if (!engine || engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') return;
    const aiColor = playerColor === 'white' ? 'black' : 'white';
    engine.gameStatus = 'checkmate';
    engine.winner = aiColor;
    handleGameEnd();
}

function offerDraw() {
    if (!engine || engine.gameStatus !== 'playing' && engine.gameStatus !== 'check') return;
    if (confirm('Accept draw? (The AI always accepts.)')) {
        engine.gameStatus = 'stalemate';
        engine.winner = null;
        handleGameEnd();
    }
}

function playAgain() {
    startGame(playerColor);
}

function switchSides() {
    startGame(playerColor === 'white' ? 'black' : 'white');
}

function backToMenu() {
    updateScores();
    updateAIPanel();
    showScreen('start-screen');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
updateScores();
updateAIPanel();
