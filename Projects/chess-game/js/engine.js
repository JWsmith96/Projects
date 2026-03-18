// Chess Engine - Full rules implementation
class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'white';
        this.enPassantTarget = null; // {row, col} square that can be captured en passant
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.moveHistory = [];
        this.gameStatus = 'playing'; // 'playing', 'check', 'checkmate', 'stalemate'
        this.winner = null;
    }

    createInitialBoard() {
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        const order = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let c = 0; c < 8; c++) {
            board[0][c] = { type: order[c], color: 'black' };
            board[1][c] = { type: 'pawn', color: 'black' };
            board[6][c] = { type: 'pawn', color: 'white' };
            board[7][c] = { type: order[c], color: 'white' };
        }
        return board;
    }

    // Returns all legal moves for the piece at (row, col)
    getLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const pseudo = this.getPseudoLegalMoves(row, col, piece);
        return pseudo.filter(move => !this.wouldLeaveKingInCheck(row, col, move, piece));
    }

    getPseudoLegalMoves(row, col, piece) {
        switch (piece.type) {
            case 'pawn':   return this.getPawnMoves(row, col, piece.color);
            case 'knight': return this.getKnightMoves(row, col, piece.color);
            case 'bishop': return this.getBishopMoves(row, col, piece.color);
            case 'rook':   return this.getRookMoves(row, col, piece.color);
            case 'queen':  return [...this.getBishopMoves(row, col, piece.color), ...this.getRookMoves(row, col, piece.color)];
            case 'king':   return this.getKingMoves(row, col, piece.color);
            default:       return [];
        }
    }

    getPawnMoves(row, col, color) {
        const moves = [];
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const promRow = color === 'white' ? 0 : 7;

        // Forward one
        const r1 = row + dir;
        if (r1 >= 0 && r1 <= 7 && !this.board[r1][col]) {
            moves.push({ row: r1, col, special: r1 === promRow ? 'promotion' : null });
            // Forward two from start
            if (row === startRow) {
                const r2 = row + 2 * dir;
                if (!this.board[r2][col]) {
                    moves.push({ row: r2, col, special: 'doublePush' });
                }
            }
        }

        // Diagonal captures
        for (const dc of [-1, 1]) {
            const c = col + dc;
            const r = row + dir;
            if (c < 0 || c > 7 || r < 0 || r > 7) continue;
            // Normal capture
            if (this.board[r][c] && this.board[r][c].color !== color) {
                moves.push({ row: r, col: c, special: r === promRow ? 'promotion' : null });
            }
            // En passant
            if (this.enPassantTarget && this.enPassantTarget.row === r && this.enPassantTarget.col === c) {
                moves.push({ row: r, col: c, special: 'enPassant' });
            }
        }
        return moves;
    }

    getKnightMoves(row, col, color) {
        const moves = [];
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const r = row + dr, c = col + dc;
            if (r < 0 || r > 7 || c < 0 || c > 7) continue;
            if (this.board[r][c]?.color === color) continue;
            moves.push({ row: r, col: c, special: null });
        }
        return moves;
    }

    getBishopMoves(row, col, color) {
        const moves = [];
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                if (this.board[r][c]) {
                    if (this.board[r][c].color !== color) moves.push({ row: r, col: c, special: null });
                    break;
                }
                moves.push({ row: r, col: c, special: null });
                r += dr; c += dc;
            }
        }
        return moves;
    }

    getRookMoves(row, col, color) {
        const moves = [];
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                if (this.board[r][c]) {
                    if (this.board[r][c].color !== color) moves.push({ row: r, col: c, special: null });
                    break;
                }
                moves.push({ row: r, col: c, special: null });
                r += dr; c += dc;
            }
        }
        return moves;
    }

    getKingMoves(row, col, color) {
        const moves = [];
        for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
            const r = row + dr, c = col + dc;
            if (r < 0 || r > 7 || c < 0 || c > 7) continue;
            if (this.board[r][c]?.color === color) continue;
            moves.push({ row: r, col: c, special: null });
        }

        // Castling — only if king is on starting square and not in check
        const kingRow = color === 'white' ? 7 : 0;
        if (row === kingRow && col === 4 && !this.isInCheck(color)) {
            const rights = this.castlingRights[color];
            // Kingside
            if (rights.kingside
                && !this.board[kingRow][5] && !this.board[kingRow][6]
                && this.board[kingRow][7]?.type === 'rook' && this.board[kingRow][7]?.color === color
                && !this.isSquareAttacked(kingRow, 5, color)
                && !this.isSquareAttacked(kingRow, 6, color)) {
                moves.push({ row: kingRow, col: 6, special: 'castleKingside' });
            }
            // Queenside
            if (rights.queenside
                && !this.board[kingRow][3] && !this.board[kingRow][2] && !this.board[kingRow][1]
                && this.board[kingRow][0]?.type === 'rook' && this.board[kingRow][0]?.color === color
                && !this.isSquareAttacked(kingRow, 3, color)
                && !this.isSquareAttacked(kingRow, 2, color)) {
                moves.push({ row: kingRow, col: 2, special: 'castleQueenside' });
            }
        }
        return moves;
    }

    isInCheck(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]?.type === 'king' && this.board[r][c]?.color === color) {
                    return this.isSquareAttacked(r, c, color);
                }
            }
        }
        return false;
    }

    // Is square (row,col) attacked by the opponent of 'color'?
    isSquareAttacked(row, col, color) {
        const opp = color === 'white' ? 'black' : 'white';

        // Knight attacks
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7 && this.board[r][c]?.type === 'knight' && this.board[r][c]?.color === opp) return true;
        }

        // Diagonal rays (bishop, queen, king at dist 1, pawn at dist 1)
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            let r = row + dr, c = col + dc, dist = 1;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const p = this.board[r][c];
                if (p) {
                    if (p.color === opp) {
                        if (p.type === 'bishop' || p.type === 'queen') return true;
                        if (dist === 1 && p.type === 'king') return true;
                        if (dist === 1 && p.type === 'pawn') {
                            // White pawns attack upward (dr = +1 from pawn = -1 from target)
                            // Black pawns attack downward (dr = -1 from pawn = +1 from target)
                            const pawnDir = opp === 'white' ? 1 : -1;
                            if (dr === pawnDir) return true;
                        }
                    }
                    break;
                }
                r += dr; c += dc; dist++;
            }
        }

        // Straight rays (rook, queen, king at dist 1)
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            let r = row + dr, c = col + dc, dist = 1;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const p = this.board[r][c];
                if (p) {
                    if (p.color === opp) {
                        if (p.type === 'rook' || p.type === 'queen') return true;
                        if (dist === 1 && p.type === 'king') return true;
                    }
                    break;
                }
                r += dr; c += dc; dist++;
            }
        }
        return false;
    }

    wouldLeaveKingInCheck(fromRow, fromCol, move, piece) {
        const savedBoard = this.board.map(r => r.map(c => c ? { ...c } : null));
        const savedEP = this.enPassantTarget;
        this.applyMoveToBoard(fromRow, fromCol, move, piece, this.board);
        const result = this.isInCheck(piece.color);
        this.board = savedBoard;
        this.enPassantTarget = savedEP;
        return result;
    }

    applyMoveToBoard(fromRow, fromCol, move, piece, board, promotionPiece = 'queen') {
        const { row, col, special } = move;
        board[row][col] = piece;
        board[fromRow][fromCol] = null;

        if (special === 'enPassant') {
            const captureRow = piece.color === 'white' ? row + 1 : row - 1;
            board[captureRow][col] = null;
        }
        if (special === 'castleKingside') {
            const kr = piece.color === 'white' ? 7 : 0;
            board[kr][5] = board[kr][7];
            board[kr][7] = null;
        }
        if (special === 'castleQueenside') {
            const kr = piece.color === 'white' ? 7 : 0;
            board[kr][3] = board[kr][0];
            board[kr][0] = null;
        }
        if (special === 'promotion') {
            board[row][col] = { type: promotionPiece, color: piece.color };
        }
        // Update en passant target for this engine instance
        this.enPassantTarget = (special === 'doublePush')
            ? { row: fromRow + (piece.color === 'white' ? -1 : 1), col }
            : null;
    }

    makeMove(fromRow, fromCol, move, promotionPiece = 'queen') {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;

        // Record captured piece (en passant is special)
        let capturedPiece = this.board[move.row][move.col];
        if (move.special === 'enPassant') {
            const captureRow = piece.color === 'white' ? move.row + 1 : move.row - 1;
            capturedPiece = this.board[captureRow][move.col];
        }

        this.applyMoveToBoard(fromRow, fromCol, move, piece, this.board, promotionPiece);

        // Update castling rights
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }
        // If rook is captured, remove castling rights for that side
        const opp = piece.color === 'white' ? 'black' : 'white';
        const oppKingRow = opp === 'white' ? 7 : 0;
        if (move.row === oppKingRow && move.col === 0) this.castlingRights[opp].queenside = false;
        if (move.row === oppKingRow && move.col === 7) this.castlingRights[opp].kingside = false;

        this.moveHistory.push({ fromRow, fromCol, toRow: move.row, toCol: move.col, piece, capturedPiece, special: move.special });
        this.currentTurn = piece.color === 'white' ? 'black' : 'white';
        this.updateGameStatus();
        return true;
    }

    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]?.color === color) {
                    for (const m of this.getLegalMoves(r, c)) {
                        moves.push({ fromRow: r, fromCol: c, ...m });
                    }
                }
            }
        }
        return moves;
    }

    updateGameStatus() {
        const color = this.currentTurn;
        const legal = this.getAllLegalMoves(color);
        if (legal.length === 0) {
            if (this.isInCheck(color)) {
                this.gameStatus = 'checkmate';
                this.winner = color === 'white' ? 'black' : 'white';
            } else {
                this.gameStatus = 'stalemate';
                this.winner = null;
            }
        } else {
            this.gameStatus = this.isInCheck(color) ? 'check' : 'playing';
        }
    }
}
