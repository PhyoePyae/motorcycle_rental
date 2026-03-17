/**
 * calendar.js — Returns events for the calendar view
 * GET /api/calendar?year=YYYY&month=MM
 *
 * Returns an object keyed by ISO date (YYYY-MM-DD) with arrays of events:
 *   { type: 'rental_start' | 'payment_due' | 'oil_change_due', ... }
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;

router.get('/', async (req, res) => {
  const year  = parseInt(req.query.year  || new Date().getFullYear(),  10);
  const month = parseInt(req.query.month || new Date().getMonth() + 1, 10);

  // Build date range for the month
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end   = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

  const events = {};

  function addEvent(date, event) {
    if (!events[date]) events[date] = [];
    events[date].push(event);
  }

  // ── Rental start dates ────────────────────────────────
  const rentalStarts = await all(`
    SELECT r.id, r.start_date, r.monthly_fee,
           c.name AS customer_name, m.bike_id, m.model
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    WHERE r.start_date >= ? AND r.start_date <= ?
  `, [start, end]);

  rentalStarts.forEach(r => {
    addEvent(r.start_date, { type: 'rental_start', rental_id: r.id, label: `Rental start: ${r.customer_name} / ${r.bike_id}`, data: r });
  });

  // ── Payment due dates (active rentals) ────────────────
  const paymentDues = await all(`
    SELECT r.id, r.next_due_date, r.monthly_fee,
           c.name AS customer_name, m.bike_id
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    WHERE r.status = 'active'
      AND r.next_due_date >= ? AND r.next_due_date <= ?
  `, [start, end]);

  paymentDues.forEach(r => {
    addEvent(r.next_due_date, { type: 'payment_due', rental_id: r.id, label: `Payment due: ${r.customer_name} / ${r.bike_id}`, data: r });
  });

  // ── Past payments recorded ────────────────────────────
  const paymentsRecorded = await all(`
    SELECT p.id, p.date, p.amount, p.note,
           c.name AS customer_name, m.bike_id
    FROM payments p
    JOIN rentals r ON r.id = p.rental_id
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    WHERE p.date >= ? AND p.date <= ?
  `, [start, end]);

  paymentsRecorded.forEach(p => {
    addEvent(p.date, { type: 'payment_made', payment_id: p.id, label: `Payment: ${p.amount.toLocaleString()} by ${p.customer_name}`, data: p });
  });

  // ── Oil change due dates ─────────────────────────────
  const oilDues = await all(`
    SELECT id, bike_id, model, last_oil_change,
      date(last_oil_change, '+30 days') AS next_oil_date
    FROM motorcycles
    WHERE last_oil_change IS NOT NULL
      AND date(last_oil_change, '+30 days') >= ?
      AND date(last_oil_change, '+30 days') <= ?
  `, [start, end]);

  oilDues.forEach(m => {
    addEvent(m.next_oil_date, { type: 'oil_change_due', motorcycle_id: m.id, label: `Oil change due: ${m.bike_id} (${m.model})`, data: m });
  });

  // ── Maintenance logs this month ──────────────────────
  const maintLogs = await all(`
    SELECT ml.id, ml.date, ml.type, ml.cost, ml.notes,
           m.bike_id, m.model
    FROM maintenance_logs ml
    JOIN motorcycles m ON m.id = ml.motorcycle_id
    WHERE ml.date >= ? AND ml.date <= ?
  `, [start, end]);

  maintLogs.forEach(l => {
    addEvent(l.date, { type: 'maintenance', log_id: l.id, label: `${l.type.replace('_',' ')}: ${l.bike_id}`, data: l });
  });

  res.json({ year, month, events });
});

module.exports = router;
