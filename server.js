const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const upload = multer({ storage: multer.memoryStorage() });

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

// --- MULTIPLE FILE UPLOAD HANDLING ---
app.post('/api/payments', upload.fields([{ name: 'photos', maxCount: 5 }, { name: 'selfie', maxCount: 1 }, { name: 'proof', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, type, profile, amount, network, ref, reference } = req.body;
        let mainImageUrl = null;
        let selfieUrl = null;

        // 1. Upload the main profile photos (we only save the first one to display on the grid for now)
        if (req.files && req.files['photos'] && req.files['photos'].length > 0) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'elite_profiles' }, (error, result) => {
                    if (error) reject(error); else resolve(result);
                }).end(req.files['photos'][0].buffer);
            });
            mainImageUrl = result.secure_url;
        }

        // 2. Upload the Verification Selfie to a separate secure folder
        if (req.files && req.files['selfie'] && req.files['selfie'].length > 0) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'elite_verification_selfies' }, (error, result) => {
                    if (error) reject(error); else resolve(result);
                }).end(req.files['selfie'][0].buffer);
            });
            selfieUrl = result.secure_url;
            console.log("Selfie uploaded for:", name, "->", selfieUrl);
        }

        // 3. Upload Payment Proof (if they are a man paying)
        if (req.files && req.files['proof'] && req.files['proof'].length > 0) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'elite_payments' }, (error, result) => {
                    if (error) reject(error); else resolve(result);
                }).end(req.files['proof'][0].buffer);
            });
            mainImageUrl = result.secure_url; 
        }

        await pool.query(
            'INSERT INTO payments (name, type, profile, amount, network, reference, status, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [name, type, profile, amount, network, ref || reference, 'Pending', mainImageUrl]
        );
        
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
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
