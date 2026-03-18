// Chess AI - Minimax with alpha-beta pruning
// "Learns" by increasing search depth and evaluation sophistication as games are played

class ChessAI {
    constructor() {
        this.gamesPlayed = 0;
    }

    // Returns current difficulty level 1-5
    getLevel() {
        if (this.gamesPlayed < 3)  return 1;
        if (this.gamesPlayed < 6)  return 2;
        if (this.gamesPlayed < 10) return 3;
        if (this.gamesPlayed < 15) return 4;
        return 5;
    }

    getLevelName() {
        return ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'][this.getLevel() - 1];
    }

    // Search depth based on level
    getDepth() {
        return [1, 2, 3, 4, 4][this.getLevel() - 1];
    }

    // Find the best move for 'color' in the current engine state
    getBestMove(engine, color) {
        const depth = this.getDepth();
        const moves = engine.getAllLegalMoves(color);
        if (moves.length === 0) return null;

        // At level 1: add randomness so it feels like a beginner
        if (this.getLevel() === 1) {
            // 40% chance to pick a random move
            if (Math.random() < 0.4) {
                return moves[Math.floor(Math.random() * moves.length)];
            }
        }

        // Sort moves for better alpha-beta pruning (captures first)
        moves.sort((a, b) => {
            const aCapture = engine.board[a.row][a.col] ? 1 : 0;
            const bCapture = engine.board[b.row][b.col] ? 1 : 0;
            return bCapture - aCapture;
        });

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            const saved = this.saveState(engine);
            engine.makeMove(move.fromRow, move.fromCol, move);
            const score = this.minimax(engine, depth - 1, -Infinity, Infinity, false, color);
            this.restoreState(engine, saved);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove || moves[0];
    }

    minimax(engine, depth, alpha, beta, isMaximizing, aiColor) {
        if (depth === 0 || engine.gameStatus === 'checkmate' || engine.gameStatus === 'stalemate') {
            return this.evaluate(engine, aiColor);
        }

        const color = engine.currentTurn;
        const moves = engine.getAllLegalMoves(color);

        if (moves.length === 0) return this.evaluate(engine, aiColor);

        // Order captures first for better pruning
        moves.sort((a, b) => {
            const aCapture = engine.board[a.row][a.col] ? 1 : 0;
            const bCapture = engine.board[b.row][b.col] ? 1 : 0;
            return bCapture - aCapture;
        });

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of moves) {
                const saved = this.saveState(engine);
                engine.makeMove(move.fromRow, move.fromCol, move);
                const score = this.minimax(engine, depth - 1, alpha, beta, false, aiColor);
                this.restoreState(engine, saved);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of moves) {
                const saved = this.saveState(engine);
                engine.makeMove(move.fromRow, move.fromCol, move);
                const score = this.minimax(engine, depth - 1, alpha, beta, true, aiColor);
                this.restoreState(engine, saved);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }

    saveState(engine) {
        return {
            board: engine.board.map(r => r.map(c => c ? { ...c } : null)),
            currentTurn: engine.currentTurn,
            enPassantTarget: engine.enPassantTarget ? { ...engine.enPassantTarget } : null,
            castlingRights: JSON.parse(JSON.stringify(engine.castlingRights)),
            moveHistory: [...engine.moveHistory],
            gameStatus: engine.gameStatus,
            winner: engine.winner
        };
    }

    restoreState(engine, state) {
        engine.board = state.board;
        engine.currentTurn = state.currentTurn;
        engine.enPassantTarget = state.enPassantTarget;
        engine.castlingRights = state.castlingRights;
        engine.moveHistory = state.moveHistory;
        engine.gameStatus = state.gameStatus;
        engine.winner = state.winner;
    }

    // Piece values (centipawns)
    static VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };

    // Piece-square tables (from white's perspective, row 0 = rank 8)
    static PST = {
        pawn: [
            [  0,  0,  0,  0,  0,  0,  0,  0],
            [ 50, 50, 50, 50, 50, 50, 50, 50],
            [ 10, 10, 20, 30, 30, 20, 10, 10],
            [  5,  5, 10, 25, 25, 10,  5,  5],
            [  0,  0,  0, 20, 20,  0,  0,  0],
            [  5, -5,-10,  0,  0,-10, -5,  5],
            [  5, 10, 10,-20,-20, 10, 10,  5],
            [  0,  0,  0,  0,  0,  0,  0,  0]
        ],
        knight: [
            [-50,-40,-30,-30,-30,-30,-40,-50],
            [-40,-20,  0,  0,  0,  0,-20,-40],
            [-30,  0, 10, 15, 15, 10,  0,-30],
            [-30,  5, 15, 20, 20, 15,  5,-30],
            [-30,  0, 15, 20, 20, 15,  0,-30],
            [-30,  5, 10, 15, 15, 10,  5,-30],
            [-40,-20,  0,  5,  5,  0,-20,-40],
            [-50,-40,-30,-30,-30,-30,-40,-50]
        ],
        bishop: [
            [-20,-10,-10,-10,-10,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5, 10, 10,  5,  0,-10],
            [-10,  5,  5, 10, 10,  5,  5,-10],
            [-10,  0, 10, 10, 10, 10,  0,-10],
            [-10, 10, 10, 10, 10, 10, 10,-10],
            [-10,  5,  0,  0,  0,  0,  5,-10],
            [-20,-10,-10,-10,-10,-10,-10,-20]
        ],
        rook: [
            [  0,  0,  0,  0,  0,  0,  0,  0],
            [  5, 10, 10, 10, 10, 10, 10,  5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [ -5,  0,  0,  0,  0,  0,  0, -5],
            [  0,  0,  0,  5,  5,  0,  0,  0]
        ],
        queen: [
            [-20,-10,-10, -5, -5,-10,-10,-20],
            [-10,  0,  0,  0,  0,  0,  0,-10],
            [-10,  0,  5,  5,  5,  5,  0,-10],
            [ -5,  0,  5,  5,  5,  5,  0, -5],
            [  0,  0,  5,  5,  5,  5,  0, -5],
            [-10,  5,  5,  5,  5,  5,  0,-10],
            [-10,  0,  5,  0,  0,  0,  0,-10],
            [-20,-10,-10, -5, -5,-10,-10,-20]
        ],
        king: [
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-30,-40,-40,-50,-50,-40,-40,-30],
            [-20,-30,-30,-40,-40,-30,-30,-20],
            [-10,-20,-20,-20,-20,-20,-20,-10],
            [ 20, 20,  0,  0,  0,  0, 20, 20],
            [ 20, 30, 10,  0,  0, 10, 30, 20]
        ]
    };

    evaluate(engine, aiColor) {
        if (engine.gameStatus === 'checkmate') {
            return engine.winner === aiColor ? 100000 : -100000;
        }
        if (engine.gameStatus === 'stalemate') return 0;

        const level = this.getLevel();
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = engine.board[r][c];
                if (!piece) continue;

                let value = ChessAI.VALUES[piece.type] || 0;

                // Level 2+: add positional bonuses
                if (level >= 2 && ChessAI.PST[piece.type]) {
                    const tableRow = piece.color === 'white' ? r : 7 - r;
                    value += ChessAI.PST[piece.type][tableRow][c];
                }

                // Level 3+: add mobility bonus (number of legal moves available)
                if (level >= 3 && (r + c) % 3 === 0) { // sample subset for performance
                    const mobility = engine.getLegalMoves(r, c).length;
                    value += mobility * 5;
                }

                score += piece.color === aiColor ? value : -value;
            }
        }

        // Level 4+: penalise doubled/isolated pawns
        if (level >= 4) {
            score += this.pawnStructureBonus(engine, aiColor);
        }

        return score;
    }

    pawnStructureBonus(engine, aiColor) {
        let bonus = 0;
        for (const color of ['white', 'black']) {
            const sign = color === aiColor ? 1 : -1;
            const pawnCols = Array(8).fill(0);
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (engine.board[r][c]?.type === 'pawn' && engine.board[r][c]?.color === color) {
                        pawnCols[c]++;
                    }
                }
            }
            for (let c = 0; c < 8; c++) {
                if (pawnCols[c] > 1) bonus += sign * -20 * (pawnCols[c] - 1); // doubled pawns penalty
                if (pawnCols[c] > 0) {
                    const isolated = (c === 0 || pawnCols[c-1] === 0) && (c === 7 || pawnCols[c+1] === 0);
                    if (isolated) bonus += sign * -15;
                }
            }
        }
        return bonus;
    }

    onGameComplete() {
        this.gamesPlayed++;
    }
}
