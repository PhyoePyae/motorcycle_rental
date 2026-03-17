/**
 * dashboard.js — Aggregated stats for the dashboard
 * GET /api/dashboard/stats          Summary cards + alerts + recent activity
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const get = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

router.get('/stats', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Summary cards ─────────────────────────────────
  const motoStats = await get(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='available'   THEN 1 ELSE 0 END) AS available,
      SUM(CASE WHEN status='rented'      THEN 1 ELSE 0 END) AS rented,
      SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) AS in_maintenance
    FROM motorcycles
  `);

  const totalCustomers = (await get(`SELECT COUNT(*) AS n FROM customers`)).n;

  // Monthly profit = payments received THIS calendar month
  const monthStart = today.slice(0, 7) + '-01';
  const [mY, mM]   = today.split('-').map(Number);
  const monthEnd   = new Date(mY, mM, 0).toISOString().slice(0, 10);
  const monthlyIncome = (await get(`
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
    WHERE date >= ? AND date <= ?
  `, [monthStart, monthEnd])).total;

  const monthlyExpenses = (await get(`
    SELECT COALESCE(SUM(cost),0) AS total FROM maintenance_logs
    WHERE date >= ? AND date <= ?
  `, [monthStart, monthEnd])).total;

  // ── 2. Alerts ────────────────────────────────────────
  // Upcoming payments: next_due_date within 3 days from today
  const in3days = new Date();
  in3days.setDate(in3days.getDate() + 3);
  const in3str = in3days.toISOString().slice(0, 10);

  const upcomingPayments = await all(`
    SELECT r.id, r.next_due_date, r.monthly_fee,
           c.name AS customer_name, c.phone,
           m.bike_id, m.model,
           COALESCE(SUM(p.amount),0) AS total_paid
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE r.status = 'active' AND r.next_due_date >= ? AND r.next_due_date <= ?
    GROUP BY r.id
  `, [today, in3str]);

  // Overdue: next_due_date < today
  const overduePayments = await all(`
    SELECT r.id, r.next_due_date, r.monthly_fee,
           c.name AS customer_name, c.phone,
           m.bike_id, m.model,
           COALESCE(SUM(p.amount),0) AS total_paid
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    LEFT JOIN payments p ON p.rental_id = r.id
    WHERE r.status = 'active' AND r.next_due_date < ?
    GROUP BY r.id
  `, [today]);

  // Oil change needed: next_oil_date (last_oil_change + 30 days) <= today
  const oilChangeNeeded = await all(`
    SELECT id, bike_id, model, plate_number, last_oil_change,
      date(last_oil_change, '+30 days') AS next_oil_date
    FROM motorcycles
    WHERE last_oil_change IS NOT NULL
      AND date(last_oil_change, '+30 days') <= ?
    ORDER BY next_oil_date ASC
  `, [today]);

  // Bikes never had oil change logged
  const noOilRecord = await all(`
    SELECT id, bike_id, model FROM motorcycles WHERE last_oil_change IS NULL
  `);

  // ── 3. Recent activity ───────────────────────────────
  const recentRentals = await all(`
    SELECT r.id, r.start_date, r.monthly_fee, r.status,
           c.name AS customer_name, m.bike_id, m.model
    FROM rentals r
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    ORDER BY r.created_at DESC LIMIT 5
  `);

  const recentPayments = await all(`
    SELECT p.id, p.date, p.amount, p.note,
           c.name AS customer_name, m.bike_id
    FROM payments p
    JOIN rentals r ON r.id = p.rental_id
    JOIN customers c ON c.id = r.customer_id
    JOIN motorcycles m ON m.id = r.motorcycle_id
    ORDER BY p.created_at DESC LIMIT 5
  `);

  const recentMaintenance = await all(`
    SELECT ml.id, ml.date, ml.type, ml.cost, ml.notes,
           m.bike_id, m.model
    FROM maintenance_logs ml
    JOIN motorcycles m ON m.id = ml.motorcycle_id
    ORDER BY ml.created_at DESC LIMIT 5
  `);

  res.json({
    summary: {
      total_motorcycles:     motoStats.total,
      available_motorcycles: motoStats.available,
      rented_motorcycles:    motoStats.rented,
      in_maintenance:        motoStats.in_maintenance,
      total_customers:       totalCustomers,
      monthly_income:        monthlyIncome,
      monthly_expenses:      monthlyExpenses,
      monthly_profit:        monthlyIncome - monthlyExpenses,
    },
    alerts: {
      upcoming_payments:  upcomingPayments,
      overdue_payments:   overduePayments,
      oil_change_needed:  [...oilChangeNeeded, ...noOilRecord],
    },
    recent: {
      rentals:     recentRentals,
      payments:    recentPayments,
      maintenance: recentMaintenance,
    },
  });
});

module.exports = router;
