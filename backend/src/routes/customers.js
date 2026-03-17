/**
 * customers.js — REST routes for customer management
 * GET    /api/customers          list all (with optional ?search=)
 * GET    /api/customers/:id      single customer + rental summary
 * POST   /api/customers          create
 * PUT    /api/customers/:id      update
 * DELETE /api/customers/:id      delete (only if no active rentals)
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

// ── LIST ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { search } = req.query;
  let rows;
  if (search) {
    const like = `%${search}%`;
    rows = await all(`
      SELECT c.*, COUNT(r.id) AS total_rentals
      FROM customers c
      LEFT JOIN rentals r ON r.customer_id = c.id
      WHERE c.name LIKE ? OR c.phone LIKE ? OR c.nrc LIKE ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [like, like, like]);
  } else {
    rows = await all(`
      SELECT c.*, COUNT(r.id) AS total_rentals
      FROM customers c
      LEFT JOIN rentals r ON r.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
  }
  res.json(rows);
});

// ── SINGLE ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const customer = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const rentals = await all(`
    SELECT r.*, m.bike_id, m.model,
           COALESCE(SUM(p.amount),0) AS total_paid
    FROM rentals r
    JOIN motorcycles m ON m.id = r.motorcycle_id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE r.customer_id = ?
    GROUP BY r.id
    ORDER BY r.start_date DESC
  `, [req.params.id]);

  res.json({ ...customer, rentals });
});

// ── CREATE ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, phone, nrc, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = await db.execute({
    sql: `
    INSERT INTO customers (name, phone, nrc, address)
    VALUES (?, ?, ?, ?)
  `,
    args: [name, phone || null, nrc || null, address || null],
  });

  const newCustomer = await get('SELECT * FROM customers WHERE id = ?', [Number(result.lastInsertRowid)]);
  res.status(201).json(newCustomer);
});

// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, phone, nrc, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const existing = await get('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  await db.execute({
    sql: `
    UPDATE customers SET name=?, phone=?, nrc=?, address=? WHERE id=?
  `,
    args: [name, phone || null, nrc || null, address || null, req.params.id],
  });

  res.json(await get('SELECT * FROM customers WHERE id = ?', [req.params.id]));
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const existing = await get('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const activeRental = await get(
    `SELECT id FROM rentals WHERE customer_id = ? AND status = 'active' LIMIT 1`
  , [req.params.id]);
  if (activeRental) {
    return res.status(409).json({ error: 'Cannot delete: customer has an active rental' });
  }

  await db.execute({ sql: 'DELETE FROM customers WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

module.exports = router;
