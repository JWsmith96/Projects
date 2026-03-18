const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const [rows] = await pool.query(
            'SELECT UserID, Username, Password, AuthLevel FROM users WHERE Username = ?',
            [username]
        );

        if (rows.length === 0) {
            return done(null, false, { message: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.Password);

        if (!match) {
            return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, {
            id: user.UserID,
            username: user.Username,
            authlevel: user.AuthLevel
        });
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await pool.query(
            'SELECT UserID, Username, AuthLevel FROM users WHERE UserID = ?',
            [id]
        );
        if (rows.length === 0) return done(null, false);
        const user = rows[0];
        done(null, { id: user.UserID, username: user.Username, authlevel: user.AuthLevel });
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
