# Backend Deployment Guide

This guide moves the custom backend from local development to managed services so you can connect DNS and onboard users.

## Recommended stack

| Layer | Service |
|---|---|
| Backend hosting | Render Web Service |
| Managed PostgreSQL | Render Postgres (or Neon) |
| File / object storage | Cloudflare R2 |
| DNS | Cloudflare |

---

## 1. Create Cloudflare R2 bucket (file storage)

Avatar uploads are stored in R2 so they survive redeployments.

1. Cloudflare Dashboard → **R2** → **Create bucket** → name it e.g. `guzzle-commerce`.
2. Inside the bucket → **Settings** → **Public access** → **Allow Access** → copy the **Public bucket URL** (looks like `https://pub-abc123.r2.dev`).
3. R2 → **Manage R2 API Tokens** → **Create API Token**:
   - Permissions: **Object Read & Write**
   - Scope: the bucket you just created
4. Copy and save:
   - **Account ID** (shown on the R2 overview page)
   - **Access Key ID**
   - **Secret Access Key**

---

## 2. Deploy managed PostgreSQL

### Option A – Render Postgres (simplest, the `render.yaml` wires it automatically)

The `render.yaml` in the repo root provisions a `guzzle-commerce-db` Postgres instance and injects `DATABASE_URL` into the backend service automatically.

**Free tier note:** Render free Postgres instances expire after 90 days. Upgrade to **Starter ($7/mo)** before going live.

### Option B – Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **connection string** (with credentials).
3. Set it as `DATABASE_URL` in the Render service environment.

---

## 3. Deploy backend service on Render

### Via Blueprint (recommended – uses `render.yaml`)

1. Push `render.yaml` (repo root) to your GitHub repo.
2. Render Dashboard → **New** → **Blueprint** → connect your repo.
3. Render detects `render.yaml` and creates both the web service and the database.
4. After the first deploy, set the secrets below in the Render Dashboard under the service's **Environment** tab (mark each as **Secret**):

| Var | Value |
|---|---|
| `JWT_SECRET` | Long random string (32+ chars) |
| `R2_ACCOUNT_ID` | From step 1 |
| `R2_ACCESS_KEY_ID` | From step 1 |
| `R2_SECRET_ACCESS_KEY` | From step 1 |
| `R2_BUCKET` | `guzzle-commerce` (or your bucket name) |
| `R2_PUBLIC_URL` | `https://pub-abc123.r2.dev` (from step 1) |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |

5. Also update these non-secret vars to your actual domains:

| Var | Example |
|---|---|
| `FRONTEND_URL` | `https://app.yourdomain.com` |
| `FRONTEND_URLS` | `https://app.yourdomain.com,https://www.yourdomain.com` |

6. Trigger a redeploy after setting secrets.

### Manual deploy (no Blueprint)

- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node 22+
- Set all the env vars from the table above manually.

---

## 4. Point DNS to backend (Cloudflare)

1. Render Dashboard → your service → **Settings** → **Custom Domains** → **Add Custom Domain** → add `api.yourdomain.com`.
2. Cloudflare DNS → add a **CNAME**: `api` → `<your-render-service>.onrender.com` (Proxy status: **DNS only** initially so TLS can provision).
3. Wait for Render to issue a TLS certificate, then you can switch to **Proxied** if desired.

---

## 5. Configure frontend to use managed backend

In your frontend hosting environment set:

```
REACT_APP_CUSTOM_BACKEND_URL=https://api.yourdomain.com
```

This is consumed by [src/util/backend.js](../src/util/backend.js).

Also ensure:
- `REACT_APP_MARKETPLACE_ROOT_URL` is your public app domain.
- Production frontend build uses correct env vars (verify with `process.env` check or `npm run config-check`).

---

## 6. Validate before onboarding users

1. `GET https://api.yourdomain.com/api/health` → `{ "status": "OK" }`
2. Register a new test user from the web app.
3. Login succeeds and profile loads.
4. Create / edit / delete a listing works end-to-end.
5. Upload an avatar → verify image loads from the R2 public URL.
6. CORS blocks unknown domains and allows your app domain.

---

## 7. Cutover checklist

1. Keep local backend running as rollback option during first release window.
2. Deploy frontend with `REACT_APP_CUSTOM_BACKEND_URL` pointing to `https://api.yourdomain.com`.
3. Smoke-test onboarding flow (signup, login, profile, listing create).
4. Monitor Render logs for 4xx/5xx spikes.
5. Announce onboarding open.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| CORS error in browser | Origin not in allowed list | Add exact origin (with protocol) to `FRONTEND_URL` / `FRONTEND_URLS` |
| Database connection error | Wrong `DATABASE_URL` or SSL mismatch | Check `DATABASE_URL`, set `DATABASE_SSL_MODE=require` |
| Avatar upload succeeds but image 404s | `R2_PUBLIC_URL` wrong or bucket not public | Re-check R2 public access setting and URL |
| 502/503 from Render | Service not listening on correct port | Confirm start command is `npm start` and app listens on `process.env.PORT` |
| R2 upload 403 | API token scoped to wrong bucket | Recreate token scoped to the correct bucket |

