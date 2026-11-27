# Deploying Quill

Quill runs as a Next.js 16 frontend on **Vercel** and an Express 4 API on **Render**, backed by **Supabase** (Postgres), **Groq** (AI), and **Resend** (email).

In production, the Vercel frontend sends API requests to same-origin `/api/...`, and `frontend/vercel.json` rewrites `/api/:path*` to the Render backend. This avoids cross-origin issues and keeps the backend host out of client-side URLs.

---

## 1. Deployment order

Deploy in this order so each service has the URLs and keys it needs:

1. **Supabase** (database)
2. **Render** (Express backend)
3. **Vercel** (Next.js frontend)

---

## 2. Step 1 — Supabase

1. Create a Supabase project (or open the existing one).
2. Open the **SQL Editor** and run `sql/setup.sql`, followed by any newer `sql/migration-*.sql` files in chronological order.
3. Verify tables exist and Row Level Security is enabled (`service_role` has full access).
4. From **Project Settings → API**, copy:
   - `SUPABASE_URL` (Project URL, e.g. `https://<project-ref>.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` (the `service_role` secret key — never expose this to the frontend)

---

## 3. Step 2 — Render (`backend/`)

`render.yaml` in the repository root is pre-configured for `backend/`:

- `rootDir`: `backend`
- `buildCommand`: `npm install`
- `startCommand`: `npm start` (`node src/index.js`)
- `healthCheckPath`: `/api/health`
- `NODE_VERSION`: `24`
- `NODE_ENV`: `production`
- `PORT`: `10000`

### Setup

1. In Render, create a **New → Blueprint** (using `render.yaml`) or a **New → Web Service** pointing to `backend/`.
2. Set the secret/environment variables listed in Section 5 (use a temporary `FRONTEND_URL` such as `http://localhost:3000` until Vercel gives you the production domain).
3. Deploy and note your Render hostname, e.g. `quill-backend.onrender.com`.

---

## 4. Step 3 — Vercel (`frontend/`)

1. Update `frontend/vercel.json` and replace `<render-host>` with your actual Render hostname:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://quill-backend.onrender.com/api/:path*"
       }
     ]
   }
   ```
   Commit and push that change before deploying on Vercel.
2. In Vercel, import the repository and set **Root Directory** to `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_BACKEND_URL=""` (empty string — `frontend/src/lib/api.ts` uses `??`, so `""` resolves to same-origin `/api/...` while leaving it unset locally falls back to `http://localhost:4000`).
4. Deploy and copy your production Vercel URL (e.g. `https://quill.vercel.app`).
5. Go back to **Render → Environment** and set `FRONTEND_URL` to your exact Vercel origin (no trailing slash; comma-separate if you have multiple allowed origins, e.g. preview/custom domains). Trigger a Render redeploy if it does not auto-restart.

---

## 5. Environment variables reference

### Backend (Render)

| Variable | Required | Value / Notes |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase `service_role` key (server-only) |
| `JWT_SECRET` | Yes | Strong random secret (e.g. `openssl rand -hex 32`) |
| `GROQ_API_KEY` | Yes | Groq API key for AI study tools & assistant |
| `RESEND_API_KEY` | Yes (for email) | Resend API key for password reset emails |
| `EMAIL_FROM` | Yes (for email) | Verified sender address, e.g. `Quill <noreply@yourdomain.com>` |
| `FRONTEND_URL` | Yes | Exact Vercel origin(s), comma-separated, no trailing slash |
| `NODE_ENV` | Yes | `production` (already set in `render.yaml`) |
| `PORT` | Managed | `10000` (already set in `render.yaml`) |
| `NODE_VERSION` | Managed | `24` (already set in `render.yaml`) |
| `DEV_MODE` | **Do NOT set** | Never set `DEV_MODE` in production (leave unset) |

### Frontend (Vercel)

| Variable | Required | Value / Notes |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes (in prod) | `""` (empty string) so requests use same-origin `/api/...` via `frontend/vercel.json`. Leave unset locally to use `http://localhost:4000`. |

---

## 6. Post-deploy smoke checks

Run these checks immediately after deploying:

1. **Direct backend health check:**
   ```bash
   curl -i https://<render-host>/api/health
   ```
   Expect `200 OK` with `{"status":"ok","timestamp":"..."}`.

2. **Vercel rewrite check:**
   ```bash
   curl -i https://<vercel-host>/api/health
   ```
   Expect `200 OK` with `{"status":"ok","timestamp":"..."}` (confirms `/api/:path*` rewrites to Render).

3. **Auth & CRUD flow in browser:**
   - Open `https://<vercel-host>`, register a test account (or sign in).
   - Confirm Network tab requests go to `https://<vercel-host>/api/...` with `200`/`201` (no CORS errors, no `localhost:4000`).
   - Create a task, refresh the page, and delete the task.

4. **AI & Email checks:**
   - Open an AI tool (e.g. Tools / Flashcards) and verify Groq responds.
   - Test "Forgot password" to confirm Resend sends email when `RESEND_API_KEY` and `EMAIL_FROM` are configured.

5. **Security check:**
   - Send `Authorization: Bearer dev-token` to `/api/tasks` — must return `401` (confirms `DEV_MODE` is off and `NODE_ENV=production`).

---

## 7. Rollback

- **Frontend (Vercel):** Open **Vercel Dashboard → Project → Deployments**, find the last known-good deployment, open the `...` menu, and select **Instant Rollback** (or **Promote to Production**).
- **Backend (Render):** Open **Render Dashboard → quill-backend → Deploys**, select the previous healthy deploy, and click **Rollback to this deploy** (or `git revert` the offending commit on `main` and push).
- **Database (Supabase):** All migrations in `sql/` are additive and idempotent. Roll back application code first; never run destructive `DROP` statements on production without a verified backup.
