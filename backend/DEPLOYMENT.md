# Backend Deployment Guide

This guide moves the custom backend from local development to a managed service so you can connect DNS and onboard users.

## Recommended stack

- Backend hosting: Render Web Service (or Railway/Fly as equivalent)
- Managed PostgreSQL: Neon or Render Postgres
- DNS: Cloudflare, Route 53, or your registrar DNS

## 1. Deploy PostgreSQL

1. Create a managed PostgreSQL instance.
2. Copy the external connection string.
3. Ensure SSL is enabled (most managed providers require it).

## 2. Deploy backend service

Deploy the [backend](backend/README.md) folder as a Node web service.

- Build command: npm install
- Start command: npm start
- Runtime: Node 22+

Set these environment variables in your managed service:

- NODE_ENV=production
- PORT=5000 (or provider default if they inject PORT)
- JWT_SECRET=<long-random-secret>
- DATABASE_URL=<managed-postgres-connection-string>
- DATABASE_SSL_MODE=require
- DB_SSL_REJECT_UNAUTHORIZED=false
- FRONTEND_URL=https://app.yourdomain.com
- FRONTEND_URLS=https://app.yourdomain.com,https://www.yourdomain.com

Notes:

- The backend starts with schema initialization automatically.
- Health check endpoint: /api/health

## 3. Point DNS to backend

Use a dedicated API subdomain.

1. Choose API domain, for example api.yourdomain.com.
2. In DNS, create:
   - CNAME api -> your-managed-service-hostname
3. In your managed service, add custom domain api.yourdomain.com.
4. Wait for TLS certificate provisioning.

## 4. Configure frontend to use managed backend

In frontend environment (where web app is hosted), set:

- REACT_APP_CUSTOM_BACKEND_URL=https://api.yourdomain.com

This value is consumed by [src/util/backend.js](../src/util/backend.js).

Also ensure:

- REACT_APP_MARKETPLACE_ROOT_URL is your public app domain
- Production frontend build uses correct env vars

## 5. Validate before onboarding users

Run these checks:

1. GET https://api.yourdomain.com/api/health returns 200
2. Register a new test user from web app
3. Login succeeds and profile loads
4. Create/edit/delete listing works
5. Avatar upload path resolves correctly from backend domain
6. CORS blocks unknown domains and allows your app domain

## 6. Cutover checklist

1. Keep local backend running as rollback option during first release window.
2. Deploy frontend with REACT_APP_CUSTOM_BACKEND_URL pointing to API domain.
3. Smoke test onboarding flow (signup, login, profile, listing create).
4. Monitor backend logs for 4xx/5xx spikes.
5. Announce onboarding open.

## Troubleshooting

- CORS error in browser:
  - Verify FRONTEND_URL and FRONTEND_URLS include exact origin with protocol.
- Database connection error:
  - Check DATABASE_URL, SSL mode, and provider network allowlist.
- 502/503 from managed host:
  - Confirm service is listening on provider PORT and startup completed.
