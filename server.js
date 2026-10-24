const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

const upload = multer({ storage: multer.memoryStorage() });

// THIS UPDATED QUERY ADDS THE IMAGE COLUMN AUTOMATICALLY
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
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS image_url TEXT;
`;

pool.query(createTableQuery).catch(err => console.error("Table error:", err));

app.get('/', (req, res) => { res.send('ELITE Backend is working!'); });

app.post('/api/payments', upload.single('proof'), async (req, res) => {
    try {
        const { name, type, profile, amount, network, ref } = req.body;
        let imageUrl = null;

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'elite_profiles' }, (error, result) => {
                    if (error) reject(error); else resolve(result);
                }).end(req.file.buffer);
            });
            imageUrl = result.secure_url;
        }

        await pool.query(
            'INSERT INTO payments (name, type, profile, amount, network, reference, status, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [name, type, profile, amount, network, ref, 'Pending', imageUrl]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/payments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments/:id/status', async (req, res) => {
    try {
        await pool.query('UPDATE payments SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
