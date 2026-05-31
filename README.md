# Carbon Zapp — Exhibition Lead Capture

Focused exhibition lead capture for visitors (QR self-submit) and staff (manual entry), backed by SQLite with continuous Excel export, filesystem photo storage, queued SendGrid emails, and a simple PWA shell for short offline gaps.

## Repository layout

- `frontend/` — React + Vite + Tailwind + React Router + Axios + PWA
- `backend/` — Express + better-sqlite3 + multer + xlsx + SendGrid queue worker
- `database/leads.db` — SQLite database (created at runtime)
- `uploads/photos/` — uploaded images
- `exports/leads.xlsx` — continuously maintained workbook
- `backups/` — timestamped DB snapshots after each lead mutation
- `catalogues/catalogue.pdf` — PDF attached to thank-you emails (add this file in production)

## Local development

### Node.js version (important for `better-sqlite3`)

`better-sqlite3` ships native binaries for common Node versions. If `npm install` fails inside `backend/` on Windows with errors about **prebuild-install** / **node-gyp** / **Python**, use **Node.js 20 LTS or 22 LTS** for local development, or install the Node.js **Desktop development with C++** / Python prerequisites so `better-sqlite3` can compile.

Production Linux servers commonly use an LTS Node release; align dev and prod on the same major version when possible.

### 1) Install

```bash
npm run install:all
```

### 2) Configure backend

Copy `backend/.env.example` to `backend/.env` and set:

- `ADMIN_PASSWORD` (required for staff dashboard sign-in at `/admin/login`)
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL` (must be a verified sender/domain in SendGrid)

### 3) Run API + UI

Terminal A (run from `backend/` so Node can resolve dependencies):

```bash
cd backend
npm run dev
```

Or from the repo root:

```bash
npm run dev:backend
```

Terminal B:

```bash
npm run dev:frontend
```

Open `http://localhost:5173` (visitor form) and `http://localhost:5173/admin/login` (staff sign-in, then dashboard).

Vite proxies `/api` and `/uploads` to `http://127.0.0.1:3001`.

## Production deployment (Linux + Nginx + PM2)

Target host: `https://leads.carbonzapp.com`

### Build the frontend

```bash
npm run build:frontend
```

This outputs `frontend/dist/`.

### PM2 (API)

Example `ecosystem.config.cjs` is included at the repo root. Adjust `cwd` to your server path.

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### Nginx (static UI + reverse proxy)

- Serve `frontend/dist` as the site root.
- Proxy `/api/` and `/uploads/` to the Node process (port `3001` by default).

Example sketch (adapt paths + SSL to your company standard):

```nginx
server {
  server_name leads.carbonzapp.com;

  root /var/www/carbon-zapp-leads/frontend/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### CORS (only if UI and API are on different origins)

Set `CORS_ORIGINS=https://leads.carbonzapp.com` in `backend/.env`.

## Security notes (current scope)

- Basic rate limiting on `/api`
- Upload type + size restrictions
- Server-side validation for lead fields and email format

Staff routes require `ADMIN_PASSWORD` sign-in. Visitor lead submission stays public. Use a strong password in production and restrict `/admin` by network or VPN if possible.

## Email queue worker

Thank-you emails are **not** sent during the HTTP request. A background worker runs every **30 seconds** and processes `email_queue`.

If `SENDGRID_API_KEY` is not set, the worker intentionally does nothing (useful for local UI testing without sending mail).

## Operational checklist before a show

- Place `catalogues/catalogue.pdf` on the server.
- Verify SendGrid sender authentication and domain DNS.
- Confirm Nginx body size limits allow photo uploads (6 MB app limit; set Nginx `client_max_body_size` accordingly).
- Take a manual copy of `database/` and `uploads/` before the event if desired (the app also writes rolling backups to `backups/`).
