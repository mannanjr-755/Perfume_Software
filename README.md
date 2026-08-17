# Perfume Store — Full-Stack Admin

Luxury perfume store admin dashboard with separated **frontend** (React + Vite) and **backend** (Express + MongoDB).

## Architecture

```text
project-root/
├── frontend/          # React UI (Vite, Tailwind)
├── backend/           # Express API + MongoDB (Mongoose)
├── scripts/           # Dev utilities (port cleanup)
├── .env.example       # Shared environment template
└── package.json       # Root scripts (npm run dev)
```

**Data flow:** Frontend → Backend API → MongoDB

Business logic lives in backend services. Database access is isolated in Mongoose models so a future SQL migration can swap the data layer without rewriting controllers.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Axios, SweetAlert2, Recharts |
| Backend | Node.js, Express, MongoDB, Mongoose, Helmet, CORS |
| Database | **MongoDB** (via `MONGODB_URI`) |

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)

## Installation

From the project root:

```bash
npm install
npm run install:all
```

`npm install` installs root tooling, and `npm run install:all` installs the
backend and frontend dependencies as well (both are required before running
`npm run dev`).

## Environment

Copy the example file and configure MongoDB:

```bash
cp .env.example .env
```

Key variables:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/perfume_store
PORT=5000
CLIENT_URL=http://127.0.0.1:5173
VITE_API_URL=/api
```

- **MongoDB URI** — set in root `.env` (backend reads it from project root)
- **Never commit** `.env` — it is listed in `.gitignore`
- Frontend API URL uses `VITE_API_URL` (defaults to `/api` via Vite proxy)

## Seed database

Creates sample data:

```bash
npm run db:seed
```

## Run (one command)

```bash
npm run dev
```

This:

1. Frees ports **5000** and **5173** if stuck
2. Starts the backend API
3. Waits for `/api/health`
4. Starts the Vite frontend

| App | URL |
|-----|-----|
| Frontend | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:5000 |

Stop both with `Ctrl+C`.

### Optional scripts

```bash
npm run dev:backend    # API only
npm run dev:frontend   # Frontend only (waits for API)
npm run build          # Build frontend for production
npm run start          # Production API + preview
npm run ports:free     # Free dev ports manually
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health + DB status |
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET | `/api/reports` | Sales and order reports |
| CRUD | `/api/products`, `/api/orders`, etc. | Resource APIs |
| GET | `/api/products/barcode/:barcode` | Look up product by barcode |
| POST | `/api/products/barcode/generate` | Generate a unique Code 128 barcode |
| POST | `/api/products/:id/generate-barcode` | Generate and assign a barcode to a product |

All responses follow:

```json
{ "success": true, "message": "...", "data": {} }
```

## Barcode Scanning & POS

The Orders page includes a **Barcode Point of Sale** panel. It works with any standard
**USB barcode scanner** (HID keyboard device) — no drivers or SDKs required. The scanner
types the code into the focused scan field and presses Enter; the product is looked up
by barcode and added to the cart automatically.

- Scan the same barcode again to increase the quantity (up to available stock).
- Unknown barcodes, inactive products, and out-of-stock products show clear messages.
- Subtotal, discount, tax (from Settings), and total are calculated automatically.
- **Completing an order deducts stock**; cancelling or deleting an order restores it.
- Products page: add/edit a `Barcode (Code 128)` field, generate a unique barcode,
  see it in the product list, and print a barcode label.
- Stock is never allowed to go negative; low-stock (≤ 5) and out-of-stock warnings
  are shown in the UI and raised as notifications.

## Features

- Dashboard with stats and recent activity
- CRUD: products, orders, customers, categories, brands, notifications
- Barcode scanning POS, barcode labels (Code 128), print support
- Automatic stock deduction / restoration on orders
- Settings and reports
- Dark / light theme
- Image upload for products
- Rate limiting and Helmet security
