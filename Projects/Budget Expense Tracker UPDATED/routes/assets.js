const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');
const { toNullable, toNullableNumber } = require('../utils/dateHelpers');

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
}

// GET /assets
router.get('/assets', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [assets] = await pool.query(`
            SELECT a.AssetID, a.Name, a.Description, at.AssetTypeID, at.Name AS AssetTypeName,
                   a.InitialBalance, a.CurrentBalance,
                   DATE_FORMAT(a.StartDate, '%Y-%m-%d') AS StartDate,
                   DATE_FORMAT(a.EndDate, '%Y-%m-%d') AS EndDate,
                   a.TargetBalance,
                   DATE_FORMAT(a.TargetDate, '%Y-%m-%d') AS TargetDate
            FROM assets a
            JOIN assettypes at ON a.AssetTypeID = at.AssetTypeID
        `);
        const [assetTypes] = await pool.query('SELECT AssetTypeID, Name FROM assettypes ORDER BY Name');
        res.render('assets', { assets, AssetTypes: assetTypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// GET /assettypes
router.get('/assettypes', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [assettypes] = await pool.query('SELECT * FROM assettypes');
        res.render('assettypes', { assettypes, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /assettypes/update
router.post('/assettypes/update', isAuthenticated, checkAuthLevel(2),
    body('editName').trim().notEmpty().withMessage('Name is required'),
    async (req, res, next) => {
    const err = validate(req, res); if (err) return;
    try {
        const { hiddenAssetTypeID, editName, editDescription } = req.body;
        if (!hiddenAssetTypeID) {
            await pool.query(
                'INSERT INTO assettypes (Name, Description) VALUES (?, ?)',
                [editName, editDescription]
            );
        } else {
            await pool.query(
                'UPDATE assettypes SET Name = ?, Description = ? WHERE AssetTypeID = ?',
                [editName, editDescription, hiddenAssetTypeID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /assettypes/delete
router.post('/assettypes/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM assettypes WHERE AssetTypeID = ?', [req.body.hiddenAssetTypeID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /assets/update
router.post('/assets/update', isAuthenticated, checkAuthLevel(2),
    body('editName').trim().notEmpty().withMessage('Name is required'),
    async (req, res, next) => {
    const err = validate(req, res); if (err) return;
    try {
        const b = req.body;
        const assetTypeID = b.editAssetType === '0' ? null : toNullableNumber(b.editAssetType);
        const fields = [
            toNullable(b.editName),
            toNullable(b.editDescription),
            assetTypeID,
            toNullableNumber(b.editInitialBalance),
            toNullableNumber(b.editCurrentBalance),
            toNullable(b.editStartDate),
            toNullable(b.editEndDate),
            toNullableNumber(b.editTargetBalance),
            toNullable(b.editTargetDate)
        ];
        if (!b.hiddenAssetID) {
            await pool.query(
                `INSERT INTO assets (Name, Description, AssetTypeID, InitialBalance, CurrentBalance,
                 StartDate, EndDate, TargetBalance, TargetDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                fields
            );
        } else {
            await pool.query(
                `UPDATE assets SET Name=?, Description=?, AssetTypeID=?, InitialBalance=?,
                 CurrentBalance=?, StartDate=?, EndDate=?, TargetBalance=?, TargetDate=?
                 WHERE AssetID=?`,
                [...fields, b.hiddenAssetID]
            );
        }
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// POST /assets/delete
router.post('/assets/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM assets WHERE AssetID = ?', [req.body.hiddenAssetID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
