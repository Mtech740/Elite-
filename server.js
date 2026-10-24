const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to your Render Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// THIS IS THE NEW PART: Create the table automatically on startup
const createTableQuery = `
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50),
    profile VARCHAR(100),
    amount INTEGER,
    network VARCHAR(50),
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

pool.query(createTableQuery)
  .then(() => console.log("Table 'payments' is ready."))
  .catch(err => console.error("Error creating table:", err));

// Test route
app.get('/', (req, res) => {
  res.send('ELITE Backend is running!');
});

// Route: Submit a payment
app.post('/api/payments', async (req, res) => {
    try {
        const { name, type, profile, amount, network, ref } = req.body;
        const result = await pool.query(
            'INSERT INTO payments (name, type, profile, amount, network, reference, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, type, profile, amount, network, ref, 'Pending']
        );
        res.json({ success: true, payment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
