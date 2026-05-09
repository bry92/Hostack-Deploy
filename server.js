const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const apiRoutes = require('./routes/api');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/api', apiRoutes(pool));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));