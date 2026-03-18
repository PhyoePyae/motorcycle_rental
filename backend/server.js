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
const { initializeSchema } = require('./src/db/schema');

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




