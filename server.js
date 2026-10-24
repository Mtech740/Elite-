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

// Automatically create the table when the server starts
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

// Test route to make sure it works
app.get('/', (req, res) => {
  res.send('ELITE Backend is running!');
});

// Route to receive payments from the website
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

// Route for Admin to approve/reject payments
app.get('/api/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payments/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE payments SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
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
