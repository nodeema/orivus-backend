const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to PostgreSQL (Render provides DATABASE_URL in environment variables)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render Postgres
});

// Create users table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50),
      country VARCHAR(50),
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      age INT,
      role VARCHAR(20) DEFAULT 'member',
      subscribed BOOLEAN DEFAULT false
    );
  `);
})();

// Signup
app.post('/signup', async (req, res) => {
  const { username, country, email, password, age } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (username, country, email, password_hash, age) VALUES ($1, $2, $3, $4, $5)',
      [username, country, email, hashedPassword, age]
    );
    res.json({ message: 'User created successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1h' });
  res.json({ message: 'Login successful', token });
});

// Subscribe
app.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: 'User not found' });

  await pool.query('UPDATE users SET subscribed = true WHERE email = $1', [email]);
  res.json({ message: 'Subscription successful' });
});

// Admin - list users
app.get('/users', async (req, res) => {
  const result = await pool.query('SELECT * FROM users');
  res.json(result.rows);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
