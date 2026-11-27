# Handoff Report: Step 1 (Foundation)

Branch: `build/step-1` (branched from `main` at `0ce6470`)

---

## 1. Tasks Done and Not Done

All 8 Phase 1 tasks are **DONE**:

| Order | ID | Task | Status | Commit |
|---|---|---|---|---|
| 1 | F1 | Testable backend and API tests | DONE | `e8a6d42` |
| 2 | F3 | Remove leftover files | DONE | `ebaba52` |
| 3 | F2 | CI checks | DONE | `ce23146` |
| 4 | B2 | Validation and error handling | DONE | `ab84b38` |
| 5 | B1 | Rate limits | DONE | `37d6155` |
| 6 | B3 | Session revocation | DONE | `387280a` |
| 7 | B6 | Remove whiteboard file fallback | DONE | `a380b0d` |
| 8 | D1 | Deployment setup and guide | DONE | `e7039f5` |

Not done in Phase 1: **None** (Phase 2+ not started, per instructions).

---

## 2. Output of Every Check (Run After Final Code Commit `e7039f5`)

- **Backend tests (`npm --prefix backend test`):**
  - `tests 45`, `suites 11`, `pass 45`, `fail 0`, `cancelled 0`, `skipped 0` (`duration_ms 4924.2766`)
  - Offline via `fakeSupabase` + ephemeral `http://127.0.0.1` server; no network or `.env` needed.
- **Frontend typecheck (`cd frontend && npx tsc --noEmit`):**
  - Exited with code `0` (`0` errors).
- **Frontend unit tests (`cd frontend && npx vitest run`):**
  - `Test Files 3 passed (3)` (`src/lib/__tests__/api.test.ts` 3, `src/features/whiteboard/__tests__/shapes.test.ts` 16, `src/features/whiteboard/__tests__/canvas-utils.test.ts` 47)
  - `Tests 66 passed (66)`
- **Frontend lint (`cd frontend && npx eslint src --format json`):**
  - `{ errors: 94, warnings: 62, total: 156 }` (down from baseline `94 errors, 64 warnings, 158 total`).

---

## 3. SQL Files (in Order)

1. `sql/migration-2026-11-27-b3.sql` — **Already run by the owner** on Supabase during Task B3:
   ```sql
   ALTER TABLE public.students
     ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

   NOTIFY pgrst, 'reload schema';
   ```
   (`sql/setup.sql` was also updated with `token_version INTEGER NOT NULL DEFAULT 0`.)

### Telegram SQL files left untouched (F3)
Per `BUILD_PLAN.md` F3, these SQL files were **not** deleted and await owner confirmation (or Phase 6 `C1`):
- `sql/add_telegram_chat_id.sql`
- `sql/notifyme-migration.sql`
- `sql/reminders-migration.sql`
- `sql/seed_dev_user.sql`
- `sql/seed_test_group.sql`
- `sql/update_rbac_to_user_ids.sql`

---

## 4. New Environment Variables

- **Required for production / local dev:** None added beyond existing variables documented in `Documents/DEPLOY.md`.
- **Deployment (`frontend` on Vercel):** Set `NEXT_PUBLIC_BACKEND_URL=""` (empty string) in Vercel so `frontend/src/lib/api.ts` resolves to same-origin `/api` and uses `frontend/vercel.json` rewrites. Leave unset locally to use `http://localhost:4000`.
- **Test-only optional flags (`backend`):** `DISABLE_RATE_LIMIT=1` / `NODE_ENV=test` disables rate limiting in tests; `ENABLE_RATE_LIMIT=1` enables it in `backend/test/rateLimit.test.js`.

---

## 5. How to Test Each Task by Hand (Including What Should Be Refused)

1. **F1 (Testable backend):** Run `npm --prefix backend test` with no `.env` or internet. Verify all 45 tests pass; check `backend/src/app.js` exports `app` without calling `listen()`.
2. **F3 (Cleanup):** Confirm `ai-smart-buddy/`, `backend/fix*.js`, `backend/supabase-schema.sql`, `backend/whiteboards_db.json`, and `frontend/refactor*.py` do not exist.
3. **F2 (CI):** Inspect `.github/workflows/ci.yml`; verify it runs on `pull_request` and `push` to `main` with Node 24, `npm test`, `npx tsc --noEmit`, `npx vitest run`, and the ESLint ceiling check (`errors <= 94`, `warnings <= 64`).
4. **B2 (Validation & errors):**
   - Send `GET /api/tasks/not-a-uuid` with a valid token -> **refused with 404**.
   - Send `POST /api/tasks` with empty title or `title.length > 200` -> **refused with 400 `{ message: "<field>: <problem>" }`**.
   - Send `DELETE /api/tasks/<valid-unused-uuid>` -> **refused with 404**.
   - Trigger a DB error -> **returns 500 `{ message: "Something went wrong" }`** (no raw DB error leaked).
5. **B1 (Rate limits):**
   - Send 11 `POST /api/auth/login` requests in 15 min from the same IP or for the same email -> **11th refused with 429 `{ message: "Too many attempts. Try again in N minutes." }`**.
   - Send 31 `/api/ai/chat` requests in 1 hour as one user -> **31st refused with 429**; `GET /api/ai/tip` remains exempt.
6. **B3 (Session revocation):**
   - Log in on two browsers/tokens (Token A, Token B).
   - Change password in Settings using Token A -> Settings stays signed in with the new token returned by `PUT /api/auth/password`.
   - Call `GET /api/auth/me` with Token B (or a legacy token without `tv`) -> **refused with 401**; in the browser, signed-in 401 clears `Quill_token` and redirects to `/login`.
   - Reset password via `POST /api/auth/reset-password` -> existing session tokens are **refused with 401**.
7. **B6 (Whiteboards):**
   - Confirm `backend/whiteboards_db.json` is never created on disk when running `npm test` or using `/api/whiteboards`.
   - Simulate a failed save in the whiteboard editor (e.g., backend stopped) -> editor shows `"Could not save"` with a keyboard-focusable `Retry` button at 375px and 1440px in light and dark mode.
8. **D1 (Deployment):**
   - Verify `frontend/vercel.json` rewrites `/api/:path*` to `https://<render-host>/api/:path*`.
   - Verify `Documents/DEPLOY.md` is followable for Supabase -> Render -> Vercel.
   - Verify local dev (`node backend/src/index.js` + `npm --prefix frontend run dev`) still connects to `http://localhost:4000` when `NEXT_PUBLIC_BACKEND_URL` is unset.

---

## 6. What Could Not Be Verified / Known Problems

- **Live browser / running-app regression & responsive UI checks (375px & 1440px, light & dark, keyboard):** Not executed in a live browser during this session (existing dev servers were left running on ports 3000 and 4000 by the user before the session). Visual/interactive checks of the B6 `"Could not save"` + `Retry` banner, B3 401 redirect in the browser, and B1 429 message rendering in the browser should be included in the reviewer pass.
- **GitHub Actions runner (`F2`):** `.github/workflows/ci.yml` was verified locally on Windows (`node -` stdin) but not yet executed on GitHub's `ubuntu-latest` runner.
- **Live Vercel / Render deployment (`D1`):** Not deployed (out of scope).
- **Pre-existing ESLint baseline:** `frontend/src` still has `94` errors and `62` warnings from before Phase 1 (within the CI ceiling of `94 / 64 / 158`).
