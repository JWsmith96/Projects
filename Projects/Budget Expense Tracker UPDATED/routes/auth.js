const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { isAuthenticated, checkAuthLevel } = require('../middleware/auth');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts, please try again later.'
});

// GET /login
router.get('/login', (req, res) => {
    res.render('login');
});

// POST /login
router.post('/login', loginLimiter, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

// GET /logout
router.get('/logout', (req, res, next) => {
    req.logout(req.user, (err) => {
        if (err) return next(err);
        res.redirect('/login');
    });
});

// GET /configuration/createnewuser
router.get('/configuration/createnewuser', isAuthenticated, checkAuthLevel(2), (req, res) => {
    res.render('createnewuser', { displayuser: req.user.username });
});

// POST /createNewUser/insert - bcrypt hash applied here
router.post('/createNewUser/insert', isAuthenticated, checkAuthLevel(2),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            await pool.query(
                'INSERT INTO users (Username, Password, AuthLevel) VALUES (?, ?, ?)',
                [req.body.username, hashedPassword, 1]
            );
            res.redirect('/configuration/edituserdetails');
        } catch (err) {
            next(err);
        }
    }
);

// GET /configuration/edituserdetails
router.get('/configuration/edituserdetails', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT UserID, Username, AuthLevel FROM users');
        res.render('edituserdetails', { edituserdetails: users, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /editUserDetails/update
router.post('/editUserDetails/update', isAuthenticated, checkAuthLevel(2),
    body('username').trim().notEmpty(),
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            if (!req.body.hiddenUserID) {
                const hashedPassword = await bcrypt.hash(req.body.password, 10);
                await pool.query(
                    'INSERT INTO users (Username, Password) VALUES (?, ?)',
                    [req.body.username, hashedPassword]
                );
            } else {
                const hashedPassword = await bcrypt.hash(req.body.password, 10);
                await pool.query(
                    'UPDATE users SET Username = ?, Password = ? WHERE UserID = ?',
                    [req.body.username, hashedPassword, req.body.hiddenUserID]
                );
            }
            res.redirect(req.get('referer'));
        } catch (err) {
            next(err);
        }
    }
);

// POST /editUserDetails/delete
router.post('/editUserDetails/delete', isAuthenticated, checkAuthLevel(2), async (req, res, next) => {
    try {
        await pool.query('DELETE FROM users WHERE UserID = ?', [req.body.userID]);
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

// GET /configuration/modifyscreenpermissions
router.get('/configuration/modifyscreenpermissions', isAuthenticated, checkAuthLevel(3), async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT UserID, Username, AuthLevel FROM users');
        res.render('modifyscreenpermissions', { modifyscreenpermissions: users, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// POST /modifyscreenpermissions/update
router.post('/modifyscreenpermissions/update', isAuthenticated, checkAuthLevel(3), async (req, res, next) => {
    try {
        await pool.query(
            'UPDATE users SET AuthLevel = ? WHERE UserID = ?',
            [req.body.authlevel, req.body.userID]
        );
        res.redirect(req.get('referer'));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
