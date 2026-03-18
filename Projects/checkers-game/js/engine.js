// Checkers Engine — full rules implementation
// Board: 8×8, pieces on dark squares only ((row+col) % 2 === 1)
// Red pieces start at rows 5-7 (bottom), Black at rows 0-2 (top)
// Red moves first

class CheckersEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'red';
        this.moveHistory = [];
        this.gameStatus = 'playing'; // 'playing' | 'gameover'
        this.winner = null;
    }

    createInitialBoard() {
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 8; c++)
                if ((r + c) % 2 === 1) board[r][c] = { type: 'man', color: 'black' };
        for (let r = 5; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if ((r + c) % 2 === 1) board[r][c] = { type: 'man', color: 'red' };
        return board;
    }

    opponent(color) { return color === 'red' ? 'black' : 'red'; }

    isKingRow(color, row) { return color === 'red' ? row === 0 : row === 7; }

    // Diagonal directions a piece can move/jump
    getDirs(piece) {
        if (piece.type === 'king') return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        return piece.color === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    }

    // ── Move generation ──────────────────────────────────────────────────────

    getAllLegalMoves(color) {
        // Mandatory capture rule: if any jump exists, only jumps are legal
        const jumps = this._getAllJumps(color);
        if (jumps.length > 0) return jumps;
        return this._getAllSimpleMoves(color);
    }

    // Legal moves for a specific piece shown in the UI.
    // Returns SINGLE-STEP jumps (not complete sequences) so the player
    // physically moves through each capture one click at a time.
    getLegalMovesFrom(row, col) {
        const color = this.board[row][col]?.color;
        if (!color) return [];
        if (this.hasMandatoryCapture(color)) return this.getSingleJumpsFrom(row, col);
        return this._getSimpleMovesFrom(row, col);
    }

    // Immediate one-step jump options from (row, col) on the current board.
    // Captured pieces are already removed by applySingleJump, so no extra
    // tracking needed — just check the live board state.
    getSingleJumpsFrom(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const jumps = [];
        for (const [dr, dc] of this.getDirs(piece)) {
            const midRow = row + dr, midCol = col + dc;
            const toRow  = row + 2 * dr, toCol  = col + 2 * dc;
            if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;
            const mid = this.board[midRow][midCol];
            if (!mid || mid.color === piece.color) continue;
            if (this.board[toRow][toCol] !== null) continue;
            jumps.push({ fromRow: row, fromCol: col, toRow, toCol, isJump: true });
        }
        return jumps;
    }

    // Apply one jump step without switching turns.
    // Returns info needed to update history and check for promotion.
    applySingleJump(fromRow, fromCol, toRow, toCol) {
        const captureRow = (fromRow + toRow) / 2;
        const captureCol = (fromCol + toCol) / 2;
        const piece        = this.board[fromRow][fromCol];
        const capturedPiece = { ...this.board[captureRow][captureCol] };

        this.board[toRow][toCol]       = { ...piece };
        this.board[fromRow][fromCol]   = null;
        this.board[captureRow][captureCol] = null;

        const becomesKing = piece.type === 'man' && this.isKingRow(piece.color, toRow);
        if (becomesKing) this.board[toRow][toCol].type = 'king';

        return { capturedPiece, captureRow, captureCol, becomesKing };
    }

    // Call once the full jump sequence is done to switch turns and check game status.
    finalizeTurn(movingColor) {
        this.currentTurn = this.opponent(movingColor);
        this.updateGameStatus();
    }

    hasMandatoryCapture(color) {
        return this._getAllJumps(color).length > 0;
    }

    _getAllJumps(color) {
        const jumps = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (this.board[r][c]?.color === color)
                    jumps.push(...this._getJumpsFrom(r, c));
        return jumps;
    }

    _getAllSimpleMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (this.board[r][c]?.color === color)
                    moves.push(...this._getSimpleMovesFrom(r, c));
        return moves;
    }

    _getSimpleMovesFrom(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const moves = [];
        for (const [dr, dc] of this.getDirs(piece)) {
            const tr = row + dr, tc = col + dc;
            if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
            if (this.board[tr][tc] !== null) continue;
            moves.push({
                fromRow: row, fromCol: col, toRow: tr, toCol: tc,
                captures: [], isJump: false,
                becomesKing: this.isKingRow(piece.color, tr)
            });
        }
        return moves;
    }

    _getJumpsFrom(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const sequences = this._exploreJumps(row, col, piece, [], this.board);
        return sequences.map(s => ({
            fromRow: row, fromCol: col,
            toRow: s.toRow, toCol: s.toCol,
            captures: s.captures, isJump: true, becomesKing: s.becomesKing
        }));
    }

    // Recursive DFS to find all complete jump sequences from (row, col).
    // Returns [{toRow, toCol, captures, becomesKing}]
    _exploreJumps(row, col, piece, capturedSoFar, board) {
        const results = [];

        for (const [dr, dc] of this.getDirs(piece)) {
            const midRow = row + dr, midCol = col + dc;
            const toRow  = row + 2 * dr, toCol  = col + 2 * dc;
            if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) continue;

            const midPiece = board[midRow][midCol];
            if (!midPiece || midPiece.color === piece.color) continue;
            if (capturedSoFar.some(c => c.row === midRow && c.col === midCol)) continue;
            if (board[toRow][toCol] !== null) continue;

            const newCaptures = [...capturedSoFar, { row: midRow, col: midCol }];
            const kinged = piece.type === 'man' && this.isKingRow(piece.color, toRow);

            if (kinged) {
                // Crowned mid-sequence — turn ends here per standard rules
                results.push({ toRow, toCol, captures: newCaptures, becomesKing: true });
            } else {
                // Advance piece on a scratch board and recurse
                const nb = board.map(r => [...r]);
                nb[toRow][toCol] = piece;
                nb[row][col] = null;
                // Captured piece stays on nb (tracked via capturedSoFar to block re-jumps)

                const deeper = this._exploreJumps(toRow, toCol, piece, newCaptures, nb);
                if (deeper.length > 0) {
                    results.push(...deeper);
                } else {
                    results.push({ toRow, toCol, captures: newCaptures, becomesKing: false });
                }
            }
        }

        return results;
    }

    // ── Execute a move ────────────────────────────────────────────────────────

    makeMove(move) {
        const { fromRow, fromCol, toRow, toCol, captures, isJump, becomesKing } = move;
        const piece = this.board[fromRow][fromCol];

        // Snapshot captured pieces before removal (for history display)
        const capturedPieces = captures.map(cap => ({
            row: cap.row, col: cap.col,
            piece: { ...this.board[cap.row][cap.col] }
        }));

        this.board[toRow][toCol] = becomesKing
            ? { type: 'king', color: piece.color }
            : { ...piece };
        this.board[fromRow][fromCol] = null;
        for (const cap of captures) this.board[cap.row][cap.col] = null;

        this.moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            captures: capturedPieces, isJump, becomesKing, piece: { ...piece }
        });

        this.currentTurn = this.opponent(piece.color);
        this.updateGameStatus();
        return true;
    }

    // ── Game status ───────────────────────────────────────────────────────────

    updateGameStatus() {
        const color = this.currentTurn;
        if (this.getAllLegalMoves(color).length === 0) {
            this.gameStatus = 'gameover';
            this.winner = this.opponent(color);
        } else {
            this.gameStatus = 'playing';
        }
    }

    countPieces(color) {
        let men = 0, kings = 0;
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p?.color === color) p.type === 'king' ? kings++ : men++;
            }
        return { men, kings, total: men + kings };
    }
}
