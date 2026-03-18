# Budget Expense Tracker

A personal budget and expense tracking web application built with Node.js, Express, MySQL, and EJS.

## Features

- Track income and expenses with recurring period support
- Manage assets and liabilities
- Finance overview table with weekly breakdowns
- Role-based authentication (AuthLevel 2 = standard, AuthLevel 3 = admin)
- D3.js line chart showing live balance data

## Prerequisites

- Node.js (v18 or higher)
- MySQL (v8 or higher)

## Setup

### 1. Clone and install dependencies

```bash
cd "Budget Expense Tracker UPDATED"
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
SESSION_SECRET=replace-with-a-long-random-string
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-database-password
DB_NAME=betracker
```

### 3. Set up the database

Run the schema script in MySQL:

```bash
mysql -u root -p < DBScripts/schema.sql
```

Then manually insert a first user with a bcrypt-hashed password. You can generate a hash using Node.js:

```js
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('yourpassword', 10));
```

Then run:

```sql
USE betracker;
INSERT INTO authlevels (AuthLevelID, LevelName) VALUES (1, 'Viewer'), (2, 'Standard'), (3, 'Admin');
INSERT INTO users (Username, Password, AuthLevel) VALUES ('admin', '<hashed-password>', 3);
```

### 4. Run the application

```bash
npm start
```

Open your browser at `http://localhost:3000`.

## Project Structure

```
server.js               # Entry point - middleware and route registration
config/passport.js      # Passport authentication strategy
db/pool.js              # MySQL2 connection pool
middleware/auth.js      # isAuthenticated and checkAuthLevel middleware
routes/
  auth.js               # Login, logout, user management
  assets.js             # Assets and asset types
  liabilities.js        # Liabilities and liability types
  incomes.js            # Incomes and income types
  expenses.js           # Expenses and expense types
  finance.js            # Finance overview, columns, breakdowns
  config.js             # Configuration page
utils/dateHelpers.js    # Date utilities (replaces moment)
views/                  # EJS templates
public/
  styles/               # CSS files
  js/                   # Client-side JavaScript (D3 graph)
DBScripts/schema.sql    # Database schema
```
