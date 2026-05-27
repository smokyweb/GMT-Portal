import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authRouter from './routes/auth.js';
import entitiesRouter from './routes/entities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/entities', entitiesRouter);

// File upload endpoint
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const fileStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`),
});
const upload = multer({ storage: fileStorage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/api/files/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, originalName: req.file.originalname });
});

app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename.replace(/[^a-zA-Z0-9._-]/g, ''));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GMT Portal API running on http://localhost:${PORT}`);
});
