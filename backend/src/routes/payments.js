/**
 * payments.js — REST routes for payment management
 * GET    /api/payments              list all (filter: ?rental_id=)
 * GET    /api/payments/:id          single payment
 * POST   /api/payments              add payment to a rental
 * PUT    /api/payments/:id          update a payment
 * DELETE /api/payments/:id          delete
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

// ── LIST ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { rental_id } = req.query;
  let sql = `
    SELECT p.*, r.monthly_fee,
      c.name AS customer_name,
      m.bike_id, m.model
    FROM payments p
    JOIN rentals r ON r.id = p.rental_id
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    WHERE 1=1
  `;
  const params = [];
  if (rental_id) { sql += ` AND p.rental_id = ?`; params.push(rental_id); }
  sql += ` ORDER BY p.date DESC`;
  res.json(await all(sql, params));
});

// ── SINGLE ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const p = await get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  res.json(p);
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { rental_id, date, amount, note } = req.body;
  if (!rental_id || !date || !amount) {
    return res.status(400).json({ error: 'rental_id, date, and amount are required' });
  }
  const rental = await get('SELECT id FROM rentals WHERE id = ?', [rental_id]);
  if (!rental) return res.status(404).json({ error: 'Rental not found' });

  const result = await db.execute({
    sql: `
    INSERT INTO payments (rental_id, date, amount, note) VALUES (?,?,?,?)
  `,
    args: [rental_id, date, amount, note || null],
  });

  // Recalculate next_due_date: advance by months based on payments
  await _advanceDueDate(rental_id);

  res.status(201).json(await get('SELECT * FROM payments WHERE id = ?', [Number(result.lastInsertRowid)]));
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { date, amount, note } = req.body;
  const existing = await get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });

  await db.execute({
    sql: `UPDATE payments SET date=?, amount=?, note=? WHERE id=?`,
    args: [date || existing.date, amount || existing.amount, note !== undefined ? note : existing.note, req.params.id],
  });

  await _advanceDueDate(existing.rental_id);
  res.json(await get('SELECT * FROM payments WHERE id = ?', [req.params.id]));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const existing = await get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  await db.execute({ sql: 'DELETE FROM payments WHERE id = ?', args: [req.params.id] });
  await _advanceDueDate(existing.rental_id);
  res.json({ success: true });
});

/**
 * _advanceDueDate
 * Recalculates next_due_date based on total payments vs monthly_fee.
 * next_due_date = start_date + ceil(total_paid / monthly_fee) months
 */
async function _advanceDueDate(rentalId) {
  const rental = await get('SELECT * FROM rentals WHERE id = ?', [rentalId]);
  if (!rental) return;
  const row = await get('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE rental_id = ?', [rentalId]);
  const monthsCovered = Math.floor(row.total / rental.monthly_fee);
  // Clamp day to end-of-month to avoid overflow (e.g. Jan 31 + 1 month → Feb 28)
  const [sy, sm, sd] = rental.start_date.split('-').map(Number);
  const totalMonths = Math.max(monthsCovered, 0) + 1;
  let ny = sy + Math.floor((sm - 1 + totalMonths) / 12);
  let nm = ((sm - 1 + totalMonths) % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  const clamped = Math.min(sd, lastDay);
  const nextDue = `${ny}-${String(nm).padStart(2,'0')}-${String(clamped).padStart(2,'0')}`;
  await db.execute({ sql: 'UPDATE rentals SET next_due_date = ? WHERE id = ?', args: [nextDue, rentalId] });
}

module.exports = router;
