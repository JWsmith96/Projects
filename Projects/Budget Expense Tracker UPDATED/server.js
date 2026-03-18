require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('./config/passport');

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: false
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session (secret loaded from .env)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 14400000 }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Home route
const pool = require('./db/pool');
const { isAuthenticated } = require('./middleware/auth');

app.get('/', isAuthenticated, async (req, res, next) => {
    try {
        const [users] = await pool.query('SELECT UserID, Username FROM users');
        res.render('index', { users, displayuser: req.user.username });
    } catch (err) {
        next(err);
    }
});

// API endpoint for graph data
app.get('/api/finlines', isAuthenticated, async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT DATE_FORMAT(LineDate, '%Y-%m-%d') AS LineDate, LineBalance
             FROM finlines WHERE LineBalance IS NOT NULL ORDER BY LineDate`
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/assets'));
app.use('/', require('./routes/liabilities'));
app.use('/', require('./routes/incomes'));
app.use('/', require('./routes/expenses'));
app.use('/', require('./routes/finance'));
app.use('/', require('./routes/config'));

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong. Please try again.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
