import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import adminRouter from './routes/admin.js';
import { setupBot } from './bot.js';
import { setupAlertBot } from './alertBot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

// Enable CORS for tonconnect-manifest.json specifically
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// API Routes
app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Secret Admin Dashboard Route (/ullu)
app.get('/ullu', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Explicitly block /admin or /admin.html
app.get(['/admin', '/admin.html'], (req, res) => {
  res.redirect('/');
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`💎 GRAM FARM AI & CLOUD MINING BOT`);
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📱 Web App URL: ${APP_URL}`);
  console.log(`🔗 TonConnect Manifest: ${APP_URL}/tonconnect-manifest.json`);
  console.log('====================================================');

  // Start Main Telegram Bot (@gramframaibot)
  setupBot(APP_URL);

  // Start Admin Alert Bot (@gramwithdrawdepualartbot)
  setupAlertBot();
});

