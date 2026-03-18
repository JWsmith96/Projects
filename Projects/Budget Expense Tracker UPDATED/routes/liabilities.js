const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');
const { toNullable, toNullableNumber } = require('../utils/dateHelpers');

// GET /liabilities
router.get('/liabilities', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [liabilities] = await pool.query(`
            SELECT a.LiabilityID, a.Name, a.Description, at.LiabilityTypeID, at.Name AS LiabilityTypeName,
                   a.InitialBalance, a.CurrentBalance,
                   DATE_FORMAT(a.StartDate, '%Y-%m-%d') AS StartDate,
                   DATE_FORMAT(a.EndDate, '%Y-%m-%d') AS EndDate,
                   a.TargetBalance,
                   DATE_FORMAT(a.TargetDate, '%Y-%m-%d') AS TargetDate
            FROM liabilities a
            JOIN liabilitytypes at ON a.LiabilityTypeID = at.LiabilityTypeID
        `);
        const [liabilityTypes] = await pool.query('SELECT LiabilityTypeID, Name FROM liabilitytypes ORDER BY Name');
        res.render('liabilities', { liabilities, LiabilityTypes: liabilityTypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// GET /liabilitytypes
router.get('/liabilitytypes', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [liabilitytypes] = await pool.query('SELECT * FROM liabilitytypes');
        res.render('liabilitytypes', { liabilitytypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /liabilitytypes/update
router.post('/liabilitytypes/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const { hiddenLiabilityTypeID, editName, editDescription } = req.body;
        if (!hiddenLiabilityTypeID) {
            await pool.query(
                'INSERT INTO liabilitytypes (Name, Description) VALUES (?, ?)',
                [editName, editDescription]
            );
        } else {
            await pool.query(
                'UPDATE liabilitytypes SET Name = ?, Description = ? WHERE LiabilityTypeID = ?',
                [editName, editDescription, hiddenLiabilityTypeID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /liabilitytypes/delete
router.post('/liabilitytypes/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM liabilitytypes WHERE LiabilityTypeID = ?', [req.body.hiddenLiabilityTypeID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /liabilities/update
router.post('/liabilities/update', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const b = req.body;
        const liabilityTypeID = b.editLiabilityType === '0' ? null : toNullableNumber(b.editLiabilityType);
        const fields = [
            toNullable(b.editName),
            toNullable(b.editDescription),
            liabilityTypeID,
            toNullableNumber(b.editInitialBalance),
            toNullableNumber(b.editCurrentBalance),
            toNullable(b.editStartDate),
            toNullable(b.editEndDate),
            toNullableNumber(b.editTargetBalance),
            toNullable(b.editTargetDate)
        ];
        if (!b.hiddenLiabilityID) {
            await pool.query(
                `INSERT INTO liabilities (Name, Description, LiabilityTypeID, InitialBalance, CurrentBalance,
                 StartDate, EndDate, TargetBalance, TargetDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                fields
            );
        } else {
            await pool.query(
                `UPDATE liabilities SET Name=?, Description=?, LiabilityTypeID=?, InitialBalance=?,
                 CurrentBalance=?, StartDate=?, EndDate=?, TargetBalance=?, TargetDate=?
                 WHERE LiabilityID=?`,
                [...fields, b.hiddenLiabilityID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /liabilities/delete
router.post('/liabilities/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM liabilities WHERE LiabilityID = ?', [req.body.hiddenLiabilityID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
