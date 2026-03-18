require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const flash = require('express-flash');
const rateLimit = require('express-rate-limit');
const pool = require('./db/pool');
const passport = require('./config/passport');

const app = express();

// Security headers
app.use(helmet());

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

// Rate limiting on auth routes (max 20 login attempts per 15 minutes per IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts, please try again later.'
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong. Please try again.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
