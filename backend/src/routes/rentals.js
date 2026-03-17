/**
 * rentals.js — REST routes for rental management
 * GET    /api/rentals             list all (filters: ?status=, ?customer_id=, ?motorcycle_id=)
 * GET    /api/rentals/:id         single rental + payment history
 * POST   /api/rentals             create rental (auto-sets next_due_date, sets bike status)
 * PUT    /api/rentals/:id         update (including completing a rental)
 * DELETE /api/rentals/:id         delete (only completed rentals)
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

// Helper: add one month to an ISO date string, clamped to end-of-month
// e.g. Jan 31 → Feb 28 (not Mar 3)
function addOneMonth(dateStr) {
  const [y, mo, day] = dateStr.split('-').map(Number);
  const nextMo   = mo === 12 ? 1 : mo + 1;
  const nextYear = mo === 12 ? y + 1 : y;
  const lastDay  = new Date(nextYear, nextMo, 0).getDate(); // last day of target month
  const clamped  = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMo).padStart(2,'0')}-${String(clamped).padStart(2,'0')}`;
}

// ── LIST ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, customer_id, motorcycle_id } = req.query;

  let sql = `
    SELECT r.*,
      c.name AS customer_name, c.phone AS customer_phone,
      m.bike_id, m.model, m.plate_number,
      COALESCE(SUM(p.amount),0) AS total_paid,
      r.monthly_fee - COALESCE(SUM(p.amount),0) AS balance_due
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (status)      { sql += ` AND r.status = ?`;          params.push(status); }
  if (customer_id) { sql += ` AND r.customer_id = ?`;     params.push(customer_id); }
  if (motorcycle_id){ sql += ` AND r.motorcycle_id = ?`;  params.push(motorcycle_id); }
  sql += ` GROUP BY r.id ORDER BY r.start_date DESC`;

  res.json(await all(sql, params));
});

// ── SINGLE ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const rental = await get(`
    SELECT r.*,
      c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
      m.bike_id, m.model, m.plate_number,
      COALESCE(SUM(p.amount),0) AS total_paid
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE r.id = ?
    GROUP BY r.id
  `, [req.params.id]);
  if (!rental) return res.status(404).json({ error: 'Rental not found' });

  const payments = await all('SELECT * FROM payments WHERE rental_id = ? ORDER BY date DESC', [req.params.id]);
  res.json({ ...rental, payments });
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { customer_id, motorcycle_id, start_date, monthly_fee, deposit, notes } = req.body;

  if (!customer_id || !motorcycle_id || !start_date || !monthly_fee) {
    return res.status(400).json({ error: 'customer_id, motorcycle_id, start_date, monthly_fee are required' });
  }

  // Guard: motorcycle must be available
  const moto = await get('SELECT status FROM motorcycles WHERE id = ?', [motorcycle_id]);
  if (!moto) return res.status(404).json({ error: 'Motorcycle not found' });
  if (moto.status !== 'available') {
    return res.status(409).json({ error: `Motorcycle is currently ${moto.status}` });
  }

  const next_due = addOneMonth(start_date);

  const result = await db.execute({
    sql: `
    INSERT INTO rentals (customer_id, motorcycle_id, start_date, monthly_fee, deposit, next_due_date, status, notes)
    VALUES (?,?,?,?,?,?,'active',?)
  `,
    args: [customer_id, motorcycle_id, start_date, monthly_fee, deposit || 0, next_due, notes || null],
  });

  // Mark motorcycle as rented
  await db.execute({ sql: `UPDATE motorcycles SET status='rented' WHERE id=?`, args: [motorcycle_id] });

  res.status(201).json(await get(`
    SELECT r.*, c.name AS customer_name, m.bike_id, m.model
    FROM rentals r JOIN customers c ON c.id=r.customer_id JOIN motorcycles m ON m.id=r.motorcycle_id
    WHERE r.id=?
  `, [Number(result.lastInsertRowid)]));
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { customer_id, motorcycle_id, start_date, monthly_fee, deposit, next_due_date, status, notes } = req.body;
  const existing = await get('SELECT * FROM rentals WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Rental not found' });

  const nextDue = next_due_date || addOneMonth(start_date || existing.start_date);

  await db.execute({
    sql: `
    UPDATE rentals SET customer_id=?, motorcycle_id=?, start_date=?, monthly_fee=?,
      deposit=?, next_due_date=?, status=?, notes=?
    WHERE id=?
  `,
    args: [
      customer_id || existing.customer_id,
      motorcycle_id || existing.motorcycle_id,
      start_date || existing.start_date,
      monthly_fee || existing.monthly_fee,
      deposit !== undefined ? deposit : existing.deposit,
      nextDue,
      status || existing.status,
      notes !== undefined ? notes : existing.notes,
      req.params.id,
    ],
  });

  // If completing the rental, free the motorcycle
  if (status === 'completed' && existing.status === 'active') {
    await db.execute({ sql: `UPDATE motorcycles SET status='available' WHERE id=?`, args: [existing.motorcycle_id] });
  }

  res.json(await get('SELECT * FROM rentals WHERE id = ?', [req.params.id]));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const existing = await get('SELECT * FROM rentals WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Rental not found' });
  if (existing.status === 'active') {
    return res.status(409).json({ error: 'Cannot delete an active rental. Complete it first.' });
  }
  await db.execute({ sql: 'DELETE FROM rentals WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

module.exports = router;
