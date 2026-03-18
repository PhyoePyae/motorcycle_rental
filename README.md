# Motorcycle Rent - Motorcycle Rental Management System

A full-stack admin dashboard for managing a motorcycle rental business.

## Tech Stack

| Layer    | Technology                                |
|----------|-------------------------------------------|
| Frontend | HTML, CSS, Vanilla JS (SPA)               |
| Backend  | Node.js + Express 5                       |
| Database | Turso (LibSQL) / SQLite file fallback     |
| Icons    | Lucide Icons (CDN)                        |
| Fonts    | Space Grotesk, Instrument Sans, Noto Sans Thai |

---

## Folder Structure

```
d:\Tayar\app\
├── backend\
│   ├── server.js              <- Express entry point
│   ├── tayar.db               <- Local SQLite file (optional fallback)
│   ├── package.json
│   └── src\
│       ├── db\
│       │   ├── schema.js      <- Table definitions
│       │   └── seed.js        <- Sample data
│       └── routes\
│           ├── customers.js
│           ├── motorcycles.js
│           ├── rentals.js
│           ├── payments.js
│           ├── maintenance.js
│           ├── dashboard.js
│           ├── calendar.js
│           └── reports.js
└── frontend\
    ├── index.html             <- SPA shell
    ├── style.css              <- UI styles
    └── app.js                 <- All page logic
```

---

## Quick Start

### 1. Install dependencies

```powershell
cd d:\Tayar\app\backend
cmd /c "npm install"
```

### 2. Configure Turso (recommended)

Set the following environment variables:

- `TURSO_DATABASE_URL` (from Turso)
- `TURSO_AUTH_TOKEN` (from Turso)
- `GOOGLE_CLIENT_ID` (OAuth client ID for Google sign-in)
- `GOOGLE_ALLOWED_EMAILS` *(optional)* comma-separated list of allowed emails

If not set, the app falls back to a local SQLite file at `backend/tayar.db`.

### 3. Seed the database with sample data (first time only)

```powershell
cmd /c "node src/db/seed.js"
```

This will populate the database with:
- 5 sample customers
- 6 motorcycles (various statuses)
- 5 rentals (4 active, 1 completed)
- 20 payments (partial, full, overdue)
- 10 maintenance logs

### 4. Start the server

```powershell
cmd /c "node server.js"
```

### 5. Open the app

Navigate to **http://localhost:3001** in your browser.

---

## API Endpoints

| Method | Endpoint                    | Description                        |
|--------|-----------------------------|------------------------------------|
| GET    | `/api/dashboard/stats`      | Summary cards, alerts, recent feed |
| GET    | `/api/customers`            | List customers (`?search=`)        |
| POST   | `/api/customers`            | Create customer                    |
| PUT    | `/api/customers/:id`        | Update customer                    |
| DELETE | `/api/customers/:id`        | Delete customer                    |
| GET    | `/api/motorcycles`          | List bikes (`?status=`, `?search=`)|
| GET    | `/api/rentals`              | List rentals (`?status=`)          |
| POST   | `/api/rentals`              | Create rental (auto next_due_date) |
| PUT    | `/api/rentals/:id`          | Update / complete rental           |
| GET    | `/api/payments`             | List payments                      |
| POST   | `/api/payments`             | Record payment (auto recalcs due)  |
| GET    | `/api/maintenance`          | List logs (`?type=`)               |
| POST   | `/api/maintenance`          | Add log (auto updates oil_change)  |
| GET    | `/api/calendar?year=&month=`| Events grouped by date             |
| GET    | `/api/reports/profit`       | Per-bike profit + totals           |
| GET    | `/api/reports/monthly`      | Monthly income/expense timeline    |

---

## Features

- **Dashboard** - Summary cards, payment alerts (overdue / upcoming 3 days), oil change alerts, recent activity feed
- **Customers** - Full CRUD with search, clickable Google Maps links
- **Motorcycles** - Status tracking, oil change due date, inline profit summary
- **Rentals** - Flexible billing, auto next_due_date calculation, complete rental workflow, inline customer/bike creation
- **Payments** - Partial/full payments, balance tracking, next_due_date auto-advance
- **Maintenance** - Oil change tracking with 30-day reminder, repair logs, cost tracking
- **Calendar** - Monthly view with color-coded events (rental starts, payments due/made, oil changes, maintenance)
- **Reports** - Per-bike profit (excl./incl. purchase price), monthly income/expense breakdown

---

## Notes

- The database file `tayar.db` is created automatically when using local SQLite fallback.
- Re-running `seed.js` clears and repopulates the database.
- The frontend is served as static files by the Express server. No separate frontend server is needed.
- Port defaults to **3001** (change via `PORT` env var).

---

## Free Hosting (Cloudflare Pages + Render)

### Backend (Render - Free Web Service)
1. Push this repo to GitHub.
2. Create a new **Web Service** on Render and connect the repo.
3. Root directory: `backend`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add environment variables in Render:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
7. Deploy and copy the public Render URL (example: `https://your-app.onrender.com`).

### Frontend (Cloudflare Pages - Static)
1. Create a new **Pages** project and connect the same repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Output directory: `frontend`
3. After the first deploy, edit `frontend/config.js` and set:
   ```js
   window.APP_CONFIG = { API_BASE: 'https://your-app.onrender.com/api' };
   ```
4. Commit and redeploy.

Your site will be live on a Cloudflare Pages URL, and the API will be on Render.

---

## Security (Google Login)

- Create an OAuth 2.0 Client ID (Web) in Google Cloud and whitelist your production domain (Render + Pages) plus `http://localhost:3001`.
- Set `GOOGLE_CLIENT_ID` in the backend environment variables.
- Update `frontend/config.js` with the same client ID and deploy both frontend and backend.
- (Optional) Set `GOOGLE_ALLOWED_EMAILS` to restrict sign-ins to specific accounts.
