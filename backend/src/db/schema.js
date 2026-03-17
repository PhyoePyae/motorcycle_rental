/**
 * schema.js
 * Defines and initializes all LibSQL tables for Motorcycle Rent Motorcycle Rental.
 */

const path = require('path');
const { createClient } = require('@libsql/client');

const FILE_DB_PATH = path.join(__dirname, '..', '..', 'tayar.db');
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${FILE_DB_PATH}`;
const DB_AUTH = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url: DB_URL, authToken: DB_AUTH });

function getDb() {
  return db;
}

async function initializeSchema() {
  await db.batch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS customers (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL,
          phone       TEXT,
          nrc         TEXT,
          address     TEXT,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS motorcycles (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          bike_id         TEXT    NOT NULL UNIQUE,
          model           TEXT    NOT NULL,
          plate_number    TEXT,
          purchase_price  REAL    NOT NULL DEFAULT 0,
          status          TEXT    NOT NULL DEFAULT 'available'
                                  CHECK(status IN ('available','rented','maintenance')),
          last_oil_change TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS rentals (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
          motorcycle_id   INTEGER NOT NULL REFERENCES motorcycles(id) ON DELETE RESTRICT,
          start_date      TEXT    NOT NULL,
          monthly_fee     REAL    NOT NULL,
          deposit         REAL    NOT NULL DEFAULT 0,
          next_due_date   TEXT    NOT NULL,
          status          TEXT    NOT NULL DEFAULT 'active'
                                  CHECK(status IN ('active','completed')),
          notes           TEXT,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS payments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          rental_id   INTEGER NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
          date        TEXT    NOT NULL,
          amount      REAL    NOT NULL,
          note        TEXT,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS maintenance_logs (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          motorcycle_id INTEGER NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
          date          TEXT    NOT NULL,
          type          TEXT    NOT NULL,
          cost          REAL    NOT NULL DEFAULT 0,
          notes         TEXT,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
  ]);

  console.log('[DB] Schema initialized.');
}

module.exports = { getDb, initializeSchema };
