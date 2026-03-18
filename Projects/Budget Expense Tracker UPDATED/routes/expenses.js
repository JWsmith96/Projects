const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');
const { toNullable, toNullableNumber, recurringPeriodList, setNextDatePeriod, getDayOfWeekDate, formatDate } = require('../utils/dateHelpers');

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    return null;
}

// GET /expenses
router.get('/expenses', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [expenses] = await pool.query(`
            SELECT e.ExpenseID, e.Name, e.Description, et.ExpenseTypeID, et.Name AS ExpenseTypeName,
                   e.AssetID, a.Name AS AssetName, e.LiabilityID, l.Name AS LiabilityName,
                   e.Amount, DATE_FORMAT(e.StartDate, '%Y-%m-%d') AS StartDate,
                   DATE_FORMAT(e.EndDate, '%Y-%m-%d') AS EndDate, e.RecurringPeriodID,
                   DATE_FORMAT(e.LastPaidDate, '%Y-%m-%d') AS LastPaidDate, e.Applied
            FROM expenses e
            LEFT JOIN expensetypes et ON e.ExpenseTypeID = et.ExpenseTypeID
            LEFT JOIN assets a ON e.AssetID = a.AssetID
            LEFT JOIN liabilities l ON e.LiabilityID = l.LiabilityID
        `);
        const [expenseTypes] = await pool.query('SELECT ExpenseTypeID, Name FROM expensetypes ORDER BY Name');
        const [assets] = await pool.query('SELECT AssetID, Name FROM assets ORDER BY Name');
        const [liabilities] = await pool.query('SELECT LiabilityID, Name FROM liabilities ORDER BY Name');
        res.render('expenses', { expenses, expenseTypes, assets, liabilities, recurringPeriod: recurringPeriodList, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// GET /expensetypes
router.get('/expensetypes', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [expensetypes] = await pool.query('SELECT * FROM expensetypes');
        res.render('expensetypes', { expensetypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /expensetypes/update
router.post('/expensetypes/update', isAuthenticated, checkAuthLevel(2),
    body('editName').trim().notEmpty().withMessage('Name is required'),
    async (req, res, next) => {
    const err = validate(req, res); if (err) return;
    try {
        const { hiddenExpenseTypeID, editName, editDescription } = req.body;
        if (!hiddenExpenseTypeID) {
            await pool.query('INSERT INTO expensetypes (Name, Description) VALUES (?, ?)', [editName, editDescription]);
        } else {
            await pool.query('UPDATE expensetypes SET Name = ?, Description = ? WHERE ExpenseTypeID = ?', [editName, editDescription, hiddenExpenseTypeID]);
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /expensetypes/delete
router.post('/expensetypes/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM expensetypes WHERE ExpenseTypeID = ?', [req.body.hiddenExpenseTypeID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /expenses/update
router.post('/expenses/update', isAuthenticated, checkAuthLevel(2),
    body('editName').trim().notEmpty().withMessage('Name is required'),
    body('editAmount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    async (req, res, next) => {
    const err = validate(req, res); if (err) return;
    const b = req.body;
    const expenseTypeID = b.editExpenseType === '0' ? null : toNullableNumber(b.editExpenseType);
    const fields = [
        toNullable(b.editName),
        toNullable(b.editDescription),
        expenseTypeID,
        toNullableNumber(b.editAsset),
        toNullableNumber(b.editLiability),
        toNullable(b.editStartDate),
        toNullable(b.editEndDate),
        toNullableNumber(b.editAmount),
        toNullableNumber(b.editRecurringPeriod),
        toNullable(b.editLastPaidDate)
    ];
    try {
        if (!b.hiddenExpenseID) {
            await pool.query(
                `INSERT INTO expenses (Name, Description, ExpenseTypeID, AssetID, LiabilityID,
                 StartDate, EndDate, Amount, RecurringPeriodID, LastPaidDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                fields
            );
        } else {
            await pool.query(
                `UPDATE expenses SET Name=?, Description=?, ExpenseTypeID=?, AssetID=?, LiabilityID=?,
                 StartDate=?, EndDate=?, Amount=?, RecurringPeriodID=?, LastPaidDate=?
                 WHERE ExpenseID=?`,
                [...fields, b.hiddenExpenseID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /expenses/delete
router.post('/expenses/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM expenses WHERE ExpenseID = ?', [req.body.hiddenExpenseID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /expenses/apply
router.post('/expenses/apply', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert finbreakdown rows for this expense
        let dateIter = new Date(b.editStartDate);
        const endDate = new Date(b.editEndDate);
        while (dateIter <= endDate) {
            await conn.query(
                `INSERT INTO finbreakdowns (IncomeID, ExpenseID, ItemDate, ItemName, ItemAmount, ItemIteration)
                 VALUES (NULL, ?, ?, ?, ?, ?)`,
                [b.hiddenExpenseID, formatDate(dateIter), b.editName, b.editAmount, 0]
            );
            dateIter = setNextDatePeriod(dateIter, b.editRecurringPeriod);
        }

        // 2. Get relevant finlines from Monday of the start date
        const mondayDate = getDayOfWeekDate(b.editStartDate, 1);
        const [relevantLines] = await conn.query(
            `SELECT FinLineID, LineDate, LineBalance FROM finlines
             WHERE AssetID <=> ? AND LiabilityID <=> ? AND LineDate >= ?
             ORDER BY LineDate`,
            [toNullableNumber(b.editAsset), toNullableNumber(b.editLiability), formatDate(mondayDate)]
        );

        // 3. Get breakdowns for this expense in range
        const [relevantBreakdowns] = await conn.query(
            `SELECT ItemDate, ItemName, ItemAmount, ItemIteration FROM finbreakdowns
             WHERE ExpenseID <=> ? AND IncomeID IS NULL AND ItemDate >= ? AND ItemDate <= ?
             ORDER BY ItemDate`,
            [b.hiddenExpenseID, b.editStartDate, b.editEndDate]
        );

        // 4. Get starting running total
        const [runningResult] = await conn.query(
            `SELECT LineBalance FROM finlines
             WHERE LineBalance IS NOT NULL AND AssetID <=> ? AND LiabilityID <=> ? AND LineDate <= ?
             ORDER BY LineDate DESC LIMIT 1`,
            [toNullableNumber(b.editAsset), toNullableNumber(b.editLiability), b.editStartDate]
        );
        let runningTotal = runningResult.length > 0 ? parseFloat(runningResult[0].LineBalance) : 0.0;

        if (runningResult.length === 0) {
            const [balResult] = await conn.query(
                `SELECT CurrentBalance FROM assets WHERE AssetID = ?`,
                [toNullableNumber(b.editAsset)]
            );
            if (balResult.length > 0 && balResult[0].CurrentBalance != null) {
                runningTotal = parseFloat(balResult[0].CurrentBalance);
            }
        }

        // 5. Merge lines and breakdowns, update finlines (expenses subtract)
        const transMap = new Map();
        for (const line of relevantLines) {
            const dow = getDayOfWeekDate(line.LineDate, 1);
            const key = formatDate(dow);
            transMap.set(key, { finLineID: line.FinLineID, lineBalance: parseFloat(line.LineBalance), itemAmount: null });
        }
        for (const bd of relevantBreakdowns) {
            const dow = getDayOfWeekDate(bd.ItemDate, 1);
            const key = formatDate(dow);
            if (transMap.has(key)) {
                transMap.get(key).itemAmount = parseFloat(bd.ItemAmount);
            } else {
                transMap.set(key, { finLineID: null, lineBalance: null, itemAmount: parseFloat(bd.ItemAmount) });
            }
        }

        const sorted = [...transMap.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));

        for (const [dateKey, entry] of sorted) {
            let balance = entry.lineBalance !== null ? entry.lineBalance : runningTotal;
            if (entry.itemAmount !== null) {
                balance -= entry.itemAmount; // expenses reduce balance
            }
            runningTotal = balance;

            if (entry.finLineID !== null) {
                await conn.query('UPDATE finlines SET LineBalance = ? WHERE FinLineID = ?', [balance, entry.finLineID]);
            } else {
                await conn.query(
                    `INSERT INTO finlines (UserID, SequenceID, AssetID, LiabilityID, LineDate, LineBalance) VALUES (0, 1, ?, ?, ?, ?)`,
                    [toNullableNumber(b.editAsset), toNullableNumber(b.editLiability), dateKey, balance]
                );
            }
        }

        // 6. Mark expense as applied
        await conn.query('UPDATE expenses SET Applied = 1 WHERE ExpenseID = ?', [b.hiddenExpenseID]);

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
