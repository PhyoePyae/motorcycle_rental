/**
 * seed.js
 * Populates the database with realistic sample data for development and demo.
 * Run once: node src/db/seed.js
 */

const { getDb, initializeSchema } = require('./schema');

async function main() {
  await initializeSchema();
  const db = getDb();

  const batch = [
    { sql: 'DELETE FROM maintenance_logs;' },
    { sql: 'DELETE FROM payments;' },
    { sql: 'DELETE FROM rentals;' },
    { sql: 'DELETE FROM motorcycles;' },
    { sql: 'DELETE FROM customers;' },
    { sql: 'DELETE FROM sqlite_sequence;' },
  ];

  const customers = [
    { name: 'Aung Ko Ko',      phone: '09-777-11111', nrc: '12/MaHaTa(N)123456', address: 'https://maps.google.com/?q=Yangon', created_at: '2025-10-01 08:00:00' },
    { name: 'Myo Thant',       phone: '09-888-22222', nrc: '9/KaMaNa(N)654321',  address: 'No. 5, Bahan Township, Yangon', created_at: '2025-10-15 09:00:00' },
    { name: 'Su Su Hlaing',    phone: '09-999-33333', nrc: null,                 address: 'https://maps.google.com/?q=Mandalay', created_at: '2025-11-01 10:00:00' },
    { name: 'Kyaw Zin Htet',   phone: '09-111-44444', nrc: '7/TaTaNa(N)112233', address: 'Pathein, Ayeyarwady', created_at: '2025-11-20 11:00:00' },
    { name: 'Thida Oo',        phone: '09-222-55555', nrc: null,                 address: 'Taunggyi, Shan State', created_at: '2025-12-01 08:30:00' },
  ];
  customers.forEach(c => {
    batch.push({
      sql: `INSERT INTO customers (name, phone, nrc, address, created_at) VALUES (?,?,?,?,?)`,
      args: [c.name, c.phone, c.nrc, c.address, c.created_at],
    });
  });

  const motorcycles = [
    { bike_id: 'TYR-001', model: 'Honda Wave 110',   plate_number: 'YGN-1A-1234', purchase_price: 1_500_000, status: 'rented',      last_oil_change: '2026-02-01', created_at: '2025-09-01 08:00:00' },
    { bike_id: 'TYR-002', model: 'Yamaha Crypton',   plate_number: 'YGN-2B-5678', purchase_price: 1_800_000, status: 'rented',      last_oil_change: '2026-01-15', created_at: '2025-09-10 08:00:00' },
    { bike_id: 'TYR-003', model: 'Suzuki Smash 115', plate_number: 'MDY-3C-9012', purchase_price: 1_600_000, status: 'available',   last_oil_change: '2026-03-01', created_at: '2025-10-01 08:00:00' },
    { bike_id: 'TYR-004', model: 'Honda Dream',      plate_number: 'YGN-4D-3456', purchase_price: 1_400_000, status: 'maintenance', last_oil_change: '2025-12-20', created_at: '2025-10-15 08:00:00' },
    { bike_id: 'TYR-005', model: 'Yamaha Fino',      plate_number: 'YGN-5E-7890', purchase_price: 1_950_000, status: 'rented',      last_oil_change: '2026-02-20', created_at: '2025-11-01 08:00:00' },
    { bike_id: 'TYR-006', model: 'Honda Winner',     plate_number: 'NTG-6F-1111', purchase_price: 2_200_000, status: 'available',   last_oil_change: '2026-03-10', created_at: '2025-12-01 08:00:00' },
  ];
  motorcycles.forEach(m => {
    batch.push({
      sql: `INSERT INTO motorcycles (bike_id, model, plate_number, purchase_price, status, last_oil_change, created_at)
            VALUES (?,?,?,?,?,?,?)`,
      args: [m.bike_id, m.model, m.plate_number, m.purchase_price, m.status, m.last_oil_change, m.created_at],
    });
  });

  const rentals = [
    { customer_id: 1, motorcycle_id: 1, start_date: '2025-10-05', monthly_fee: 150_000, deposit: 300_000, next_due_date: '2026-03-05', status: 'active',    notes: null,                      created_at: '2025-10-05 09:00:00' },
    { customer_id: 2, motorcycle_id: 2, start_date: '2025-10-20', monthly_fee: 180_000, deposit: 360_000, next_due_date: '2026-03-20', status: 'active',    notes: 'Prefers weekend pickup',  created_at: '2025-10-20 09:00:00' },
    { customer_id: 3, motorcycle_id: 5, start_date: '2025-11-10', monthly_fee: 200_000, deposit: 400_000, next_due_date: '2026-03-10', status: 'active',    notes: null,                      created_at: '2025-11-10 09:00:00' },
    { customer_id: 4, motorcycle_id: 3, start_date: '2025-07-01', monthly_fee: 160_000, deposit: 300_000, next_due_date: '2025-10-01', status: 'completed', notes: 'Returned on time',        created_at: '2025-07-01 09:00:00' },
    { customer_id: 5, motorcycle_id: 6, start_date: '2025-12-15', monthly_fee: 220_000, deposit: 440_000, next_due_date: '2026-03-15', status: 'active',    notes: null,                      created_at: '2025-12-15 09:00:00' },
  ];
  rentals.forEach(r => {
    batch.push({
      sql: `INSERT INTO rentals (customer_id, motorcycle_id, start_date, monthly_fee, deposit, next_due_date, status, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [r.customer_id, r.motorcycle_id, r.start_date, r.monthly_fee, r.deposit, r.next_due_date, r.status, r.notes, r.created_at],
    });
  });

  const payments = [
    { rental_id: 1, date: '2025-10-05', amount: 150_000, note: 'Month 1',                    created_at: '2025-10-05 10:00:00' },
    { rental_id: 1, date: '2025-11-05', amount: 150_000, note: 'Month 2',                    created_at: '2025-11-05 10:00:00' },
    { rental_id: 1, date: '2025-12-05', amount: 150_000, note: 'Month 3',                    created_at: '2025-12-05 10:00:00' },
    { rental_id: 1, date: '2026-01-05', amount: 150_000, note: 'Month 4',                    created_at: '2026-01-05 10:00:00' },
    { rental_id: 1, date: '2026-02-05', amount: 150_000, note: 'Month 5',                    created_at: '2026-02-05 10:00:00' },
    { rental_id: 2, date: '2025-10-20', amount: 180_000, note: 'Month 1',                    created_at: '2025-10-20 10:00:00' },
    { rental_id: 2, date: '2025-11-20', amount: 180_000, note: 'Month 2',                    created_at: '2025-11-20 10:00:00' },
    { rental_id: 2, date: '2025-12-20', amount: 180_000, note: 'Month 3',                    created_at: '2025-12-20 10:00:00' },
    { rental_id: 2, date: '2026-01-20', amount: 180_000, note: 'Month 4',                    created_at: '2026-01-20 10:00:00' },
    { rental_id: 2, date: '2026-02-20', amount: 100_000, note: 'Month 5 - partial payment',  created_at: '2026-02-20 10:00:00' },
    { rental_id: 3, date: '2025-11-10', amount: 200_000, note: 'Month 1',                    created_at: '2025-11-10 10:00:00' },
    { rental_id: 3, date: '2025-12-10', amount: 200_000, note: 'Month 2',                    created_at: '2025-12-10 10:00:00' },
    { rental_id: 3, date: '2026-01-10', amount: 200_000, note: 'Month 3',                    created_at: '2026-01-10 10:00:00' },
    { rental_id: 3, date: '2026-02-10', amount: 200_000, note: 'Month 4',                    created_at: '2026-02-10 10:00:00' },
    { rental_id: 4, date: '2025-07-01', amount: 160_000, note: 'Month 1 + deposit',          created_at: '2025-07-01 10:00:00' },
    { rental_id: 4, date: '2025-08-01', amount: 160_000, note: 'Month 2',                    created_at: '2025-08-01 10:00:00' },
    { rental_id: 4, date: '2025-09-01', amount: 160_000, note: 'Month 3',                    created_at: '2025-09-01 10:00:00' },
    { rental_id: 5, date: '2025-12-15', amount: 220_000, note: 'Month 1',                    created_at: '2025-12-15 10:00:00' },
    { rental_id: 5, date: '2026-01-15', amount: 220_000, note: 'Month 2',                    created_at: '2026-01-15 10:00:00' },
    { rental_id: 5, date: '2026-02-15', amount: 220_000, note: 'Month 3',                    created_at: '2026-02-15 10:00:00' },
  ];
  payments.forEach(p => {
    batch.push({
      sql: `INSERT INTO payments (rental_id, date, amount, note, created_at)
            VALUES (?,?,?,?,?)`,
      args: [p.rental_id, p.date, p.amount, p.note, p.created_at],
    });
  });

  const maintenanceLogs = [
    { motorcycle_id: 1, date: '2026-02-01', type: 'oil_change', cost: 15_000, notes: 'SAE 10W-40',                 created_at: '2026-02-01 08:00:00' },
    { motorcycle_id: 2, date: '2026-01-15', type: 'oil_change', cost: 15_000, notes: null,                          created_at: '2026-01-15 08:00:00' },
    { motorcycle_id: 3, date: '2026-03-01', type: 'oil_change', cost: 15_000, notes: null,                          created_at: '2026-03-01 08:00:00' },
    { motorcycle_id: 4, date: '2025-12-20', type: 'oil_change', cost: 15_000, notes: null,                          created_at: '2025-12-20 08:00:00' },
    { motorcycle_id: 4, date: '2026-01-10', type: 'repair',     cost: 85_000, notes: 'Front brake cable replaced',  created_at: '2026-01-10 08:00:00' },
    { motorcycle_id: 4, date: '2026-02-28', type: 'repair',     cost: 120_000,notes: 'Carburetor cleaning + chain', created_at: '2026-02-28 08:00:00' },
    { motorcycle_id: 5, date: '2026-02-20', type: 'oil_change', cost: 15_000, notes: null,                          created_at: '2026-02-20 08:00:00' },
    { motorcycle_id: 6, date: '2026-03-10', type: 'oil_change', cost: 15_000, notes: 'First service',               created_at: '2026-03-10 08:00:00' },
    { motorcycle_id: 1, date: '2025-11-15', type: 'repair',     cost: 45_000, notes: 'Tyre replacement (rear)',     created_at: '2025-11-15 08:00:00' },
    { motorcycle_id: 2, date: '2025-12-01', type: 'other',      cost: 10_000, notes: 'General cleanup & check',     created_at: '2025-12-01 08:00:00' },
  ];
  maintenanceLogs.forEach(m => {
    batch.push({
      sql: `INSERT INTO maintenance_logs (motorcycle_id, date, type, cost, notes, created_at)
            VALUES (?,?,?,?,?,?)`,
      args: [m.motorcycle_id, m.date, m.type, m.cost, m.notes, m.created_at],
    });
  });

  await db.batch(batch);

  console.log('[Seed] Database populated with sample data.');
  console.log(`  Customers:         ${customers.length}`);
  console.log(`  Motorcycles:       ${motorcycles.length}`);
  console.log(`  Rentals:           ${rentals.length}`);
  console.log(`  Payments:          ${payments.length}`);
  console.log(`  Maintenance logs:  ${maintenanceLogs.length}`);
}

main().catch(err => {
  console.error('[Seed] Failed:', err.message || err);
  process.exit(1);
});
