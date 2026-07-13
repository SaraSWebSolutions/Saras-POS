# Saras POS (Free Version) — Backend API

Node.js + Express + MongoDB (Mongoose) backend implementing the full API list and
requirements from **SaraSPOS_Free_version_API_List.pdf** and **SaraSPOS_Freeversion_APP.pdf**.

Covers all 10 modules: Authentication, Dashboard, Billing/POS, Products, Categories,
Customers, Stock, Reports, Settings, Notifications — 140 endpoints in total.

## 1. Requirements

- Node.js 18+
- MongoDB 6+ (local or Atlas)

## 2. Setup

```bash
cd saraspos-backend
npm install
cp .env.example .env    # then edit MONGO_URI, JWT_SECRET, SMTP_* etc.
npm run seed             # creates a default admin user + default settings
npm run dev               # starts on http://localhost:5000 (nodemon)
# or
npm start
```

Default seeded admin login:
```
email: admin@saraspos.com
password: Admin@123
```
Change this password immediately after first login (`PUT /auth/change-password`).

## 3. Project Structure

```
src/
  config/db.js             MongoDB connection
  models/                  Mongoose schemas (User, Product, Category, Customer,
                            Cart, StockHistory, Notification, Settings, Counter)
  controllers/              Business logic per module
  routes/                    Express routers per module + routes/index.js
  middleware/               auth (JWT), upload (multer), validate, errorHandler
  utils/                     response helper, ApiError, jwt, sequence (invoice
                              numbers), exporter (PDF/Excel), email/OTP, seed
  uploads/                    Uploaded images + generated PDF/Excel files (served
                              statically at /uploads/<file>)
```

All routes are mounted under **`/api/v1`**, e.g. `POST /api/v1/auth/login`.

## 4. Standard Response Shape

Success:
```json
{ "status": true, "message": "Success", "data": {} }
```
Error / Validation:
```json
{ "status": false, "message": "Validation Error", "errors": {} }
```
Error codes used: `401` Unauthorized, `403` Forbidden, `404` Not Found,
`422` Validation, `500` Internal Server Error — matching the requirement doc.

## 5. Authentication

Every route except `/auth/login`, `/auth/forgot-password`, `/auth/verify-otp`,
`/auth/reset-password` requires a Bearer token:

```
Authorization: Bearer <JWT from /auth/login>
```

Roles: `admin` (full access) and `staff` (billing-focused). A few destructive
routes (deleting invoices, editing shop/tax/billing/printer settings, viewing
the user list) are restricted to `admin` via the `authorize("admin")` middleware
— adjust as needed for your real role matrix.

## 6. Billing Flow (matches the Billing Flow diagram in the app spec)

1. `POST /billing/cart` → create a cart/session
2. `GET /billing/products` / `/billing/products/barcode/:barcode` → browse or scan
3. `POST /billing/cart/add-item` → add product (auto stock check)
4. `PUT /billing/cart/update-item` → change quantity
5. `POST /billing/cart/apply-discount` → flat or percentage
6. GST is auto-calculated per item (`gstRate` from the product) on every cart mutation
7. `POST /billing/customer/add` (optional) → attach a customer
8. `POST /billing/payment/cash` | `/upi` | `/split` → record payment (must total the
   grand total)
9. `POST /billing/invoice/generate` → generates invoice number, reduces stock,
   logs `StockHistory`, updates customer's total purchase, marks cart `completed`
10. `GET /billing/print/:invoiceNo` → printable receipt JSON (respects the
    configured printer width, 58mm/80mm)
11. `GET /billing/share/whatsapp/:invoiceNo` → generates an invoice PDF and
    returns its URL for sharing

Hold / Resume: `POST /billing/hold` → `GET /billing/hold/list` →
`POST /billing/resume/:id`. Cancel: `POST /billing/cancel/:id` (restores stock
if the bill was already completed).

## 7. Notes & Assumptions

- **Invoices are stored as `Cart` documents** with `status: "completed"` — this
  avoids duplicating billing data across two collections while still satisfying
  every `/billing/*` and `/reports/*` endpoint in the spec.
- **Barcode generation** (`POST /products/barcode/generate`) creates a unique
  13-digit numeric code and a Code128 barcode PNG (via `bwip-js`) saved to
  `/uploads`.
- **PDF/Excel exports** (`stock`, `reports`) are generated with `pdfkit` /
  `exceljs` and saved to `/uploads`, with the endpoint returning a `url` you can
  download or share directly.
- **Backup/Restore** (`/settings/backup`, `/settings/restore`) snapshot/restore
  Settings, Users, Products, Categories and Customers as JSON. Extend to include
  billing history if you need a full data restore.
- Multer enforces JPEG/PNG uploads up to `MAX_IMAGE_SIZE_MB` (default 5MB).
- Swap the in-file JWT blacklist-free `logout` for a real token-blacklist
  collection if you need server-side session invalidation.

## 8. Quick Smoke Test (curl)

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saraspos.com","password":"Admin@123"}'

# Use the returned token for everything else, e.g.
curl http://localhost:5000/api/v1/dashboard/summary \
  -H "Authorization: Bearer <TOKEN>"
```
