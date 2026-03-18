const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');
const { toNullable, toNullableNumber, recurringPeriodList, setNextDatePeriod, getDayOfWeekDate, formatDate } = require('../utils/dateHelpers');
const { isSameDay } = require('date-fns');

// GET /incomes
router.get('/incomes', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [incomes] = await pool.query(`
            SELECT i.IncomeID, i.Name, i.Description, it.IncomeTypeID, it.Name AS IncomeTypeName,
                   i.AssetID, a.Name AS AssetName, i.LiabilityID, l.Name AS LiabilityName,
                   i.Amount, DATE_FORMAT(i.StartDate, '%Y-%m-%d') AS StartDate,
                   DATE_FORMAT(i.EndDate, '%Y-%m-%d') AS EndDate, i.RecurringPeriodID,
                   DATE_FORMAT(i.LastReceivedDate, '%Y-%m-%d') AS LastReceivedDate, i.Applied
            FROM incomes i
            LEFT JOIN incometypes it ON i.IncomeTypeID = it.IncomeTypeID
            LEFT JOIN assets a ON i.AssetID = a.AssetID
            LEFT JOIN liabilities l ON i.LiabilityID = l.LiabilityID
        `);
        const [incomeTypes] = await pool.query('SELECT IncomeTypeID, Name FROM incometypes ORDER BY Name');
        const [assets] = await pool.query('SELECT AssetID, Name FROM assets ORDER BY Name');
        const [liabilities] = await pool.query('SELECT LiabilityID, Name FROM liabilities ORDER BY Name');
        res.render('incomes', { incomes, incomeTypes, assets, liabilities, recurringPeriod: recurringPeriodList, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// GET /incometypes
router.get('/incometypes', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [incometypes] = await pool.query('SELECT * FROM incometypes');
        res.render('incometypes', { incometypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /incometypes/update
router.post('/incometypes/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const { hiddenIncomeTypeID, editName, editDescription } = req.body;
        if (!hiddenIncomeTypeID) {
            await pool.query('INSERT INTO incometypes (Name, Description) VALUES (?, ?)', [editName, editDescription]);
        } else {
            await pool.query('UPDATE incometypes SET Name = ?, Description = ? WHERE IncomeTypeID = ?', [editName, editDescription, hiddenIncomeTypeID]);
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /incometypes/delete
router.post('/incometypes/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM incometypes WHERE IncomeTypeID = ?', [req.body.hiddenIncomeTypeID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /incomes/update
router.post('/incomes/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    const b = req.body;
    const incomeTypeID = b.editIncomeType === '0' ? null : toNullableNumber(b.editIncomeType);
    const assetID = toNullableNumber(b.editAsset);
    const liabilityID = toNullableNumber(b.editLiability);
    const fields = [
        toNullable(b.editName),
        toNullable(b.editDescription),
        incomeTypeID,
        assetID,
        liabilityID,
        toNullable(b.editStartDate),
        toNullable(b.editEndDate),
        toNullableNumber(b.editAmount),
        toNullableNumber(b.editRecurringPeriod),
        toNullable(b.editLastReceivedDate)
    ];
    try {
        if (!b.hiddenIncomeID) {
            await pool.query(
                `INSERT INTO incomes (Name, Description, IncomeTypeID, AssetID, LiabilityID,
                 StartDate, EndDate, Amount, RecurringPeriodID, LastReceivedDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                fields
            );
        } else {
            await pool.query(
                `UPDATE incomes SET Name=?, Description=?, IncomeTypeID=?, AssetID=?, LiabilityID=?,
                 StartDate=?, EndDate=?, Amount=?, RecurringPeriodID=?, LastReceivedDate=?
                 WHERE IncomeID=?`,
                [...fields, b.hiddenIncomeID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /incomes/delete
router.post('/incomes/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM incomes WHERE IncomeID = ?', [req.body.hiddenIncomeID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /incomes/apply
router.post('/incomes/apply', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    const b = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert finbreakdown rows for this income
        let dateIter = new Date(b.editStartDate);
        const endDate = new Date(b.editEndDate);
        while (dateIter <= endDate) {
            await conn.query(
                `INSERT INTO finbreakdowns (IncomeID, ExpenseID, ItemDate, ItemName, ItemAmount, ItemIteration)
                 VALUES (?, NULL, ?, ?, ?, ?)`,
                [b.hiddenIncomeID, formatDate(dateIter), b.editName, b.editAmount, 0]
            );
            dateIter = setNextDatePeriod(dateIter, b.editRecurringPeriod);
        }

        // 2. Get relevant finlines from the Monday of the start date
        const mondayDate = getDayOfWeekDate(b.editStartDate, 1);
        const [relevantLines] = await conn.query(
            `SELECT FinLineID, LineDate, LineBalance FROM finlines
             WHERE AssetID <=> ? AND LiabilityID <=> ? AND LineDate >= ?
             ORDER BY LineDate`,
            [toNullableNumber(b.editAsset), toNullableNumber(b.editLiability), formatDate(mondayDate)]
        );

        // 3. Get breakdowns for this income in range
        const [relevantBreakdowns] = await conn.query(
            `SELECT ItemDate, ItemName, ItemAmount, ItemIteration FROM finbreakdowns
             WHERE IncomeID <=> ? AND ExpenseID IS NULL AND ItemDate >= ? AND ItemDate <= ?
             ORDER BY ItemDate`,
            [b.hiddenIncomeID, b.editStartDate, b.editEndDate]
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

        // 5. Merge lines and breakdowns, update finlines
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
                balance += entry.itemAmount;
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

        // 6. Mark income as applied
        await conn.query('UPDATE incomes SET Applied = 1 WHERE IncomeID = ?', [b.hiddenIncomeID]);

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
