/**
 * motorcycles.js — REST routes for motorcycle management
 * GET    /api/motorcycles         list all (with optional ?status=, ?search=)
 * GET    /api/motorcycles/:id     single bike + maintenance summary + profit
 * POST   /api/motorcycles         create
 * PUT    /api/motorcycles/:id     update
 * DELETE /api/motorcycles/:id     delete (no active rentals guard)
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

// ── LIST ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, search } = req.query;

  let sql = `
    SELECT m.*,
      COALESCE(SUM(ml.cost),0) AS total_maintenance_cost,
      COUNT(DISTINCT r.id)      AS total_rentals,
      COALESCE(SUM(p.amount),0) AS total_income,
      date(m.last_oil_change, '+30 days') AS next_oil_date
    FROM motorcycles m
    LEFT JOIN maintenance_logs ml ON ml.motorcycle_id = m.id
    LEFT JOIN rentals r  ON r.motorcycle_id = m.id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { sql += ` AND m.status = ?`; params.push(status); }
  if (search) {
    sql += ` AND (m.bike_id LIKE ? OR m.model LIKE ? OR m.plate_number LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ` GROUP BY m.id ORDER BY m.bike_id ASC`;

  res.json(await all(sql, params));
});

// ── SINGLE ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const moto = await get(`
    SELECT m.*,
      date(m.last_oil_change, '+30 days') AS next_oil_date
    FROM motorcycles m WHERE m.id = ?
  `, [req.params.id]);
  if (!moto) return res.status(404).json({ error: 'Motorcycle not found' });

  const maintenanceLogs = await all(`
    SELECT * FROM maintenance_logs WHERE motorcycle_id = ? ORDER BY date DESC
  `, [req.params.id]);

  const totalMaintCost = maintenanceLogs.reduce((s, l) => s + l.cost, 0);

  const incomeRow = await get(`
    SELECT COALESCE(SUM(p.amount),0) AS total_income
    FROM rentals r
    JOIN payments p ON p.rental_id = r.id
    WHERE r.motorcycle_id = ?
  `, [req.params.id]);

  const profit = incomeRow.total_income - totalMaintCost;

  res.json({ ...moto, maintenance_logs: maintenanceLogs, total_maintenance_cost: totalMaintCost, total_income: incomeRow.total_income, profit });
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { bike_id, model, plate_number, purchase_price, status, last_oil_change } = req.body;
  if (!bike_id || !model) return res.status(400).json({ error: 'bike_id and model are required' });

  const dup = await get('SELECT id FROM motorcycles WHERE bike_id = ?', [bike_id]);
  if (dup) return res.status(409).json({ error: 'Bike ID already exists' });

  const result = await db.execute({
    sql: `
    INSERT INTO motorcycles (bike_id, model, plate_number, purchase_price, status, last_oil_change)
    VALUES (?,?,?,?,?,?)
  `,
    args: [bike_id, model, plate_number || null, purchase_price || 0, status || 'available', last_oil_change || null],
  });

  res.status(201).json(await get('SELECT * FROM motorcycles WHERE id = ?', [Number(result.lastInsertRowid)]));
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { bike_id, model, plate_number, purchase_price, status, last_oil_change } = req.body;
  const existing = await get('SELECT id FROM motorcycles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Motorcycle not found' });

  // Check unique bike_id (excluding self)
  const dup = await get('SELECT id FROM motorcycles WHERE bike_id = ? AND id != ?', [bike_id, req.params.id]);
  if (dup) return res.status(409).json({ error: 'Bike ID already used by another motorcycle' });

  await db.execute({
    sql: `
    UPDATE motorcycles SET bike_id=?, model=?, plate_number=?, purchase_price=?, status=?, last_oil_change=?
    WHERE id=?
  `,
    args: [bike_id, model, plate_number || null, purchase_price || 0, status || 'available', last_oil_change || null, req.params.id],
  });

  res.json(await get('SELECT * FROM motorcycles WHERE id = ?', [req.params.id]));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const existing = await get('SELECT id FROM motorcycles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Motorcycle not found' });

  const activeRental = await get(
    `SELECT id FROM rentals WHERE motorcycle_id = ? AND status = 'active' LIMIT 1`
  , [req.params.id]);
  if (activeRental) return res.status(409).json({ error: 'Cannot delete: motorcycle has an active rental' });

  await db.execute({ sql: 'DELETE FROM motorcycles WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

module.exports = router;
