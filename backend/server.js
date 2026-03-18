/**
 * server.js - Main Express entry point for Motorcycle Rent Motorcycle Rental API
 *
 * Start: node server.js
 * API base: http://localhost:3001/api
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { OAuth2Client } = require('google-auth-library');
const { initializeSchema } = require('./src/db/schema');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_ALLOWED_EMAILS = (process.env.GOOGLE_ALLOWED_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function verifyGoogleToken(idToken) {
  if (!googleClient) throw new Error('GOOGLE_CLIENT_ID not configured');
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw new Error('Invalid Google token');
  const email = payload.email.toLowerCase();
  if (GOOGLE_ALLOWED_EMAILS.length && !GOOGLE_ALLOWED_EMAILS.includes(email)) {
    const err = new Error('Email not allowed');
    err.status = 403;
    throw err;
  }
  return {
    email,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub,
  };
}

// Initialize DB schema on startup
async function startServer() {
  try {
    await initializeSchema();
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err.message || err);
    process.exit(1);
  }

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve frontend static files
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  // Auth middleware for all API routes except login
  app.use('/api', async (req, res, next) => {
    if (req.path === '/auth/google') return next();
    try {
      const auth = req.header('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Missing token' });
      req.user = await verifyGoogleToken(token);
      return next();
    } catch (err) {
      const status = err.status || 401;
      return res.status(status).json({ error: err.message || 'Unauthorized' });
    }
  });

  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken) return res.status(400).json({ error: 'idToken required' });
      const user = await verifyGoogleToken(idToken);
      return res.json({ ok: true, user });
    } catch (err) {
      const status = err.status || 401;
      return res.status(status).json({ error: err.message || 'Unauthorized' });
    }
  });

  // API routes
  app.use('/api/dashboard',   require('./src/routes/dashboard'));
  app.use('/api/customers',   require('./src/routes/customers'));
  app.use('/api/motorcycles', require('./src/routes/motorcycles'));
  app.use('/api/rentals',     require('./src/routes/rentals'));
  app.use('/api/payments',    require('./src/routes/payments'));
  app.use('/api/maintenance', require('./src/routes/maintenance'));
  app.use('/api/calendar',    require('./src/routes/calendar'));
  app.use('/api/reports',     require('./src/routes/reports'));

  // Catch-all: serve frontend for SPA routing
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // Start server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n  Motorcycle Rent Motorcycle Rental API`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`  Database: ${process.env.TURSO_DATABASE_URL || 'file:tayar.db'}`);
    console.log(`  API: http://localhost:${PORT}/api\n`);
  });
}

startServer();




