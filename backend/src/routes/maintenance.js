/**
 * maintenance.js — REST routes for maintenance logs
 * GET    /api/maintenance          list all logs (filter: ?motorcycle_id=, ?type=)
 * GET    /api/maintenance/:id      single log
 * POST   /api/maintenance          create log (automatically updates last_oil_change if type=oil_change)
 * PUT    /api/maintenance/:id      update log
 * DELETE /api/maintenance/:id      delete log
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

// ── LIST ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { motorcycle_id, type } = req.query;
  let sql = `
    SELECT ml.*, m.bike_id, m.model, m.plate_number
    FROM maintenance_logs ml
    JOIN motorcycles m ON m.id = ml.motorcycle_id
    WHERE 1=1
  `;
  const params = [];
  if (motorcycle_id) { sql += ` AND ml.motorcycle_id = ?`; params.push(motorcycle_id); }
  if (type)          { sql += ` AND ml.type = ?`;           params.push(type); }
  sql += ` ORDER BY ml.date DESC`;
  res.json(await all(sql, params));
});

// ── SINGLE ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const log = await get(`
    SELECT ml.*, m.bike_id, m.model FROM maintenance_logs ml
    JOIN motorcycles m ON m.id = ml.motorcycle_id
    WHERE ml.id = ?
  `, [req.params.id]);
  if (!log) return res.status(404).json({ error: 'Maintenance log not found' });
  res.json(log);
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { motorcycle_id, date, type, cost, notes } = req.body;
  if (!motorcycle_id || !date || !type) {
    return res.status(400).json({ error: 'motorcycle_id, date, and type are required' });
  }
  const moto = await get('SELECT id FROM motorcycles WHERE id = ?', [motorcycle_id]);
  if (!moto) return res.status(404).json({ error: 'Motorcycle not found' });

  const result = await db.execute({
    sql: `
    INSERT INTO maintenance_logs (motorcycle_id, date, type, cost, notes)
    VALUES (?,?,?,?,?)
  `,
    args: [motorcycle_id, date, type, cost || 0, notes || null],
  });

  // If it's an oil change, update last_oil_change on the motorcycle
  if (type === 'oil_change') {
    await db.execute({ sql: `UPDATE motorcycles SET last_oil_change = ? WHERE id = ?`, args: [date, motorcycle_id] });
  }

  res.status(201).json(await get(`
    SELECT ml.*, m.bike_id, m.model FROM maintenance_logs ml
    JOIN motorcycles m ON m.id = ml.motorcycle_id
    WHERE ml.id = ?
  `, [Number(result.lastInsertRowid)]));
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { date, type, cost, notes } = req.body;
  const existing = await get('SELECT * FROM maintenance_logs WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Maintenance log not found' });

  await db.execute({
    sql: `
    UPDATE maintenance_logs SET date=?, type=?, cost=?, notes=? WHERE id=?
  `,
    args: [
      date  || existing.date,
      type  || existing.type,
      cost  !== undefined ? cost : existing.cost,
      notes !== undefined ? notes : existing.notes,
      req.params.id,
    ],
  });

  // Re-sync last_oil_change: find most recent oil change for this bike
  if ((type || existing.type) === 'oil_change') {
    const latest = await get(`
      SELECT date FROM maintenance_logs
      WHERE motorcycle_id = ? AND type = 'oil_change'
      ORDER BY date DESC LIMIT 1
    `, [existing.motorcycle_id]);
    if (latest) {
      await db.execute({ sql: `UPDATE motorcycles SET last_oil_change = ? WHERE id = ?`, args: [latest.date, existing.motorcycle_id] });
    }
  }

  res.json(await get('SELECT * FROM maintenance_logs WHERE id = ?', [req.params.id]));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const existing = await get('SELECT * FROM maintenance_logs WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Maintenance log not found' });

  await db.execute({ sql: 'DELETE FROM maintenance_logs WHERE id = ?', args: [req.params.id] });

  // Re-sync last_oil_change after deletion
  const latest = await get(`
    SELECT date FROM maintenance_logs
    WHERE motorcycle_id = ? AND type = 'oil_change'
    ORDER BY date DESC LIMIT 1
  `, [existing.motorcycle_id]);
  await db.execute({ sql: `UPDATE motorcycles SET last_oil_change = ? WHERE id = ?`, args: [latest ? latest.date : null, existing.motorcycle_id] });

  res.json({ success: true });
});

module.exports = router;
