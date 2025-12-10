// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors()); // allow requests from GitHub Pages

// ---- Database connection ----
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render PostgreSQL
});

// ---- Ensure admin exists ----
async function ensureAdmin() {
  const adminEmail = "assbreakerzx@gmail.com";
  const adminPassword = "omaramarvin1755"; // ⚠️ In production, hash this!
  const adminUsername = "Admin";

  try {
    const res = await pool.query("SELECT * FROM users WHERE email=$1", [adminEmail]);
    if (res.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (email, password, username, country, age, role) VALUES ($1,$2,$3,$4,$5,$6)",
        [adminEmail, adminPassword, adminUsername, "N/A", "N/A", "admin"]
      );
      console.log("✅ Admin account created");
    } else {
      console.log("ℹ️ Admin already exists");
    }
  } catch (err) {
    console.error("Error ensuring admin:", err);
  }
}

// ---- Signup ----
app.post("/signup", async (req, res) => {
  const { email, password, username, country, age } = req.body;
  try {
    const exists = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (exists.rows.length > 0) {
      return res.json({ success: false, message: "Email already exists" });
    }
    await pool.query(
      "INSERT INTO users (email, password, username, country, age, role) VALUES ($1,$2,$3,$4,$5,$6)",
      [email, password, username, country, age, "member"]
    );
    res.json({ success: true, user: { email, username, role: "member" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---- Login ----
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1 AND password=$2", [email, password]);
    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Invalid email or password" });
    }
    const user = result.rows[0];
    const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET || "secretkey");
    res.json({ success: true, token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---- Get all users ----
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT email, username, country, age, role FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---- Root route ----
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// ---- Start server ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await ensureAdmin(); // seed admin on startup
});



