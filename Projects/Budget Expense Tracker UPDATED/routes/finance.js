const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');
const { toNullable, toNullableNumber, getDayOfWeekDate, formatDate } = require('../utils/dateHelpers');
const { addDays, format } = require('date-fns');

// GET /finance
router.get('/finance', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [finCols] = await pool.query('SELECT SequenceID, Name, AssetID, LiabilityID FROM fincols ORDER BY SequenceID');
        const [finLines] = await pool.query(`
            SELECT fc.SequenceID, DATE_FORMAT(fl.LineDate, '%Y-%m-%d') AS LineDate,
                   fl.AssetID, fl.LiabilityID, fl.LineBalance
            FROM fincols fc
            JOIN finlines fl ON IF(fc.AssetID IS NULL, fc.LiabilityID = fl.LiabilityID, fc.AssetID = fl.AssetID)
            ORDER BY fl.LineDate, fc.SequenceID
        `);
        res.render('finance', { finCols, finLines, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// GET /financecols
router.get('/financecols', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [financecols] = await pool.query(`
            SELECT fc.FinColID, fc.SequenceID, fc.AssetID, a.Name AS AssetName,
                   fc.LiabilityID, l.Name AS LiabilityName, fc.Name
            FROM fincols fc
            LEFT JOIN assets a ON fc.AssetID = a.AssetID
            LEFT JOIN liabilities l ON fc.LiabilityID = l.LiabilityID
            ORDER BY fc.SequenceID
        `);
        const [assets] = await pool.query('SELECT AssetID, Name FROM assets ORDER BY Name');
        const [liabilities] = await pool.query('SELECT LiabilityID, Name FROM liabilities ORDER BY Name');
        res.render('financecols', { financecols, assets, liabilities, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /financecols/update
router.post('/financecols/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const b = req.body;
        const sequenceID = toNullableNumber(b.editSequenceID) || 999;
        const fields = [sequenceID, toNullableNumber(b.editAsset), toNullableNumber(b.editLiability), toNullable(b.editName)];
        if (!b.hiddenFinColID) {
            await pool.query(
                'INSERT INTO fincols (UserID, SequenceID, AssetID, LiabilityID, Name) VALUES (0, ?, ?, ?, ?)',
                fields
            );
        } else {
            await pool.query(
                'UPDATE fincols SET SequenceID=?, AssetID=?, LiabilityID=?, Name=? WHERE FinColID=?',
                [...fields, b.hiddenFinColID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /financecols/delete
router.post('/financecols/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM fincols WHERE FinColID = ?', [req.body.hiddenFinColID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// GET /financebreakdowns
router.get('/financebreakdowns', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        let breakdownsQuery = `
            SELECT fb.FinBreakdownID, fb.ItemIteration, fb.IncomeID, i.Name AS IncomeName,
                   fb.ExpenseID, e.Name AS ExpenseName,
                   DATE_FORMAT(fb.ItemDate, '%Y-%m-%d') AS ItemDate,
                   fb.ItemName, fb.ItemAmount
            FROM finbreakdowns fb
            LEFT JOIN incomes i ON fb.IncomeID = i.IncomeID
            LEFT JOIN expenses e ON fb.ExpenseID = e.ExpenseID
        `;
        const params = [];
        if (req.query.dateBreakdown) {
            const dtStart = req.query.dateBreakdown;
            const dtEnd = format(addDays(new Date(dtStart), 6), 'yyyy-MM-dd');
            breakdownsQuery += ' WHERE fb.ItemDate >= ? AND fb.ItemDate <= ?';
            params.push(dtStart, dtEnd);
        }
        breakdownsQuery += ' ORDER BY ItemDate';

        const [financebreakdowns] = await pool.query(breakdownsQuery, params);
        const [incomes] = await pool.query('SELECT IncomeID, Name FROM incomes ORDER BY Name');
        const [expenses] = await pool.query('SELECT ExpenseID, Name FROM expenses ORDER BY Name');
        res.render('financebreakdowns', { financebreakdowns, incomes, expenses, messages: null, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /financebreakdowns/update
router.post('/financebreakdowns/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const itemAmount = parseFloat(b.editItemAmount) || 0;
        const itemDate = b.editItemDate || new Date().toISOString().split('T')[0];
        const iterationValue = toNullableNumber(b.ItemIteration) || 999;

        // Determine asset/liability from income or expense
        let assetID = null;
        let liabilityID = null;
        if (b.editIncomeOrExpense == 1) {
            const [rows] = await conn.query('SELECT AssetID, LiabilityID FROM incomes WHERE IncomeID = ?', [b.editIncome]);
            if (rows.length > 0) { assetID = rows[0].AssetID; liabilityID = rows[0].LiabilityID; }
        } else if (b.editIncomeOrExpense == 2) {
            const [rows] = await conn.query('SELECT AssetID, LiabilityID FROM expenses WHERE ExpenseID = ?', [b.editExpense]);
            if (rows.length > 0) { assetID = rows[0].AssetID; liabilityID = rows[0].LiabilityID; }
        }

        // Get previous amount for this breakdown
        const [prevRows] = await conn.query('SELECT ItemAmount FROM finbreakdowns WHERE FinBreakdownID = ?', [b.hiddenFinBreakdownID]);
        const prevAmount = prevRows.length > 0 ? parseFloat(prevRows[0].ItemAmount) : 0;

        // Get finlines for this asset/liability from the breakdown's week
        const sowDate = getDayOfWeekDate(itemDate, 1);
        const [lines] = await conn.query(
            `SELECT FinLineID, LineBalance FROM finlines WHERE AssetID <=> ? AND LiabilityID <=> ? AND LineDate >= ? ORDER BY LineDate`,
            [assetID, liabilityID, formatDate(sowDate)]
        );

        // Adjust finline balances by the difference
        const diff = b.editIncomeOrExpense == 1 ? (itemAmount - prevAmount) : (prevAmount - itemAmount);
        for (const line of lines) {
            await conn.query('UPDATE finlines SET LineBalance = ? WHERE FinLineID = ?', [parseFloat(line.LineBalance) + diff, line.FinLineID]);
        }

        // Update the breakdown record
        await conn.query(
            `UPDATE finbreakdowns SET IncomeID=?, ExpenseID=?, ItemDate=?, ItemName=?, ItemAmount=?, ItemIteration=?
             WHERE FinBreakdownID=?`,
            [toNullableNumber(b.editIncome), toNullableNumber(b.editExpense), itemDate, b.editItemName, itemAmount, iterationValue, b.hiddenFinBreakdownID]
        );

        await conn.commit();
        res.redirect(req.get('referer'));
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

// POST /financebreakdowns/delete
router.post('/financebreakdowns/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Get the breakdown to reverse its effect on finlines
        const [bdRows] = await conn.query(
            'SELECT IncomeID, ExpenseID, ItemDate, ItemAmount FROM finbreakdowns WHERE FinBreakdownID = ?',
            [b.hiddenFinBreakdownID]
        );

        if (bdRows.length > 0) {
            const bd = bdRows[0];
            const isIncome = bd.IncomeID != null;
            const isExpense = bd.ExpenseID != null;
            let assetID = null;
            let liabilityID = null;

            if (isIncome) {
                const [rows] = await conn.query('SELECT AssetID, LiabilityID FROM incomes WHERE IncomeID = ?', [bd.IncomeID]);
                if (rows.length > 0) { assetID = rows[0].AssetID; liabilityID = rows[0].LiabilityID; }
            } else if (isExpense) {
                const [rows] = await conn.query('SELECT AssetID, LiabilityID FROM expenses WHERE ExpenseID = ?', [bd.ExpenseID]);
                if (rows.length > 0) { assetID = rows[0].AssetID; liabilityID = rows[0].LiabilityID; }
            }

            const sowDate = getDayOfWeekDate(bd.ItemDate, 1);
            const [lines] = await conn.query(
                `SELECT FinLineID, LineBalance FROM finlines WHERE AssetID <=> ? AND LiabilityID <=> ? AND LineDate >= ? ORDER BY LineDate`,
                [assetID, liabilityID, formatDate(sowDate)]
            );

            const amount = parseFloat(bd.ItemAmount) || 0;
            for (const line of lines) {
                const newBalance = isIncome
                    ? parseFloat(line.LineBalance) - amount
                    : parseFloat(line.LineBalance) + amount;
                await conn.query('UPDATE finlines SET LineBalance = ? WHERE FinLineID = ?', [newBalance, line.FinLineID]);
            }
        }

        await conn.query('DELETE FROM finbreakdowns WHERE FinBreakdownID = ?', [b.hiddenFinBreakdownID]);

        await conn.commit();
        res.redirect(req.get('referer'));
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
});

module.exports = router;
