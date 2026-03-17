/**
 * reports.js — Profit & revenue reporting endpoints
 * GET /api/reports/profit             Per-bike profit + totals
 * GET /api/reports/monthly            Monthly income/expense breakdown
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');
const db = getDb();
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;

// ── PER-BIKE PROFIT ───────────────────────────────────────
router.get('/profit', async (req, res) => {
  const bikes = await all(`
    SELECT m.id, m.bike_id, m.model, m.plate_number,
           m.purchase_price, m.status,
           COALESCE(inc.total_income, 0)        AS total_income,
           COALESCE(maint.total_maint_cost, 0)  AS total_maint_cost
    FROM motorcycles m
    LEFT JOIN (
      SELECT r.motorcycle_id, SUM(p.amount) AS total_income
      FROM payments p JOIN rentals r ON r.id = p.rental_id
      GROUP BY r.motorcycle_id
    ) inc   ON inc.motorcycle_id = m.id
    LEFT JOIN (
      SELECT motorcycle_id, SUM(cost) AS total_maint_cost
      FROM maintenance_logs
      GROUP BY motorcycle_id
    ) maint ON maint.motorcycle_id = m.id
    ORDER BY m.bike_id ASC
  `);

  const result = bikes.map(b => ({
    ...b,
    profit_excl_purchase: b.total_income - b.total_maint_cost,
    profit_incl_purchase: b.total_income - b.total_maint_cost - b.purchase_price,
  }));

  const totals = {
    total_income:          result.reduce((s, b) => s + b.total_income,          0),
    total_maint_cost:      result.reduce((s, b) => s + b.total_maint_cost,      0),
    total_purchase_cost:   result.reduce((s, b) => s + b.purchase_price,        0),
    total_profit_excl:     result.reduce((s, b) => s + b.profit_excl_purchase,  0),
    total_profit_incl:     result.reduce((s, b) => s + b.profit_incl_purchase,  0),
  };

  res.json({ bikes: result, totals });
});

// ── MONTHLY BREAKDOWN ────────────────────────────────────
router.get('/monthly', async (req, res) => {
  // Income per month
  const income = await all(`
    SELECT strftime('%Y-%m', date) AS month,
           SUM(amount)             AS income
    FROM payments
    GROUP BY month
    ORDER BY month ASC
  `);

  // Expenses per month
  const expenses = await all(`
    SELECT strftime('%Y-%m', date) AS month,
           SUM(cost)               AS expenses
    FROM maintenance_logs
    GROUP BY month
    ORDER BY month ASC
  `);

  // Merge into a single timeline
  const months = {};
  income.forEach(r  => { months[r.month] = { month: r.month, income: r.income, expenses: 0 }; });
  expenses.forEach(r => {
    if (!months[r.month]) months[r.month] = { month: r.month, income: 0, expenses: 0 };
    months[r.month].expenses = r.expenses;
  });

  const timeline = Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, profit: m.income - m.expenses }));

  res.json(timeline);
});

module.exports = router;
