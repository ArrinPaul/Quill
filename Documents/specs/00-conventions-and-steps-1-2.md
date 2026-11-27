# Spec: Conventions, Step 1 (Foundation), Step 2 (Promised features)

Detail for `Documents/BUILD_PLAN.md`. BUILD_PLAN section 1 (rules) and section 7 (handoff) apply. If code and spec disagree, stop and ask.

## 0. Conventions for every spec

### 0.1 API
- Base `/api`. JSON in and out. Auth header `Authorization: Bearer <token>`.
- Success returns a named object: `{ task }`, `{ tasks }`. Errors return `{ message }`.
- Status: 400 invalid input, 401 no or bad session, 404 missing **or not yours**, 409 conflict, 413 too large, 429 limit, 503 provider down.
- Create returns 201. Lists take `?limit=` (default 50, max 100) and `?before=<created_at ISO>`, and return `{ items, nextBefore }` (new endpoints only; do not change existing shapes).
- Frontend calls only through `api` in `src/lib/api.ts`. Add `api.upload` for multipart when first needed.

### 0.2 Backend layout
`src/routes/<area>.js` (HTTP and validation), `src/services/<name>.js` (logic), `src/schemas/<area>.js` (zod). Register routers in `app.js`.

### 0.3 SQL template
```sql
CREATE TABLE IF NOT EXISTS public.example (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_example_student ON public.example(student_id, created_at DESC);
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.example TO service_role;
-- end every migration with:
NOTIFY pgrst, 'reload schema';
```
Tables below list only their own columns; `id`, `created_at`, RLS, grant and foreign-key indexes are implied.

### 0.4 Frontend
Page in `src/app/(dashboard)/dashboard/<name>/page.tsx` stays thin; logic in `src/features/<name>/{components,hooks,lib}`. Sidebar entries in `components/shared/Sidebar.tsx` (check `MobileNav` and `MobileFooter` too). Types in `src/features/types.ts`.

### 0.5 Tests
Backend `backend/test/<area>.test.js` with `node:test`. Every new route: success, missing token, another user's id, invalid input. Pure logic: unit tests with a fixed "now".

## Step 1: Foundation

### F1. Testable backend
- `src/app.js`: builds and exports `app`. `src/index.js`: loads env, requires app, listens.
- Database seam: `services/supabase.js` gains `setClient(fake)` for tests.
- `test/helpers/fakeSupabase.js`: in-memory tables supporting the chain methods the routes use (`from select insert update delete upsert eq in gte lt lte order single maybeSingle`). Throw on anything unsupported.
- Script: `"test": "node --test"`.
- First tests: register and login (including upper-case email), token for deleted account, reset token refused as session, ownership for tasks, notices, quizzes, flashcards (all routes), whiteboards, attendance; calendar feed signature.

### F3. Cleanup
As listed in BUILD_PLAN. Search for each filename before deleting.

### F2. CI (`.github/workflows/ci.yml`)
On pull request and push to `main`, Node 24: `npm ci` in `backend` and `frontend`; `npm test`; `npx tsc --noEmit`; `npx vitest run`; lint with `npx eslint src --max-warnings 64` plus a script that fails if errors exceed 94 (JSON formatter). No secrets needed.

### B2. Validation and errors
- `middleware/validate.js`: `validate({ body, params, query })` using zod; replaces `req` values with parsed ones; 400 `{ message: "<field>: <problem>" }`.
- Limits: title 200 chars, description 5,000, notice text 20,000, AI notes 50,000, subject 100, arrays 200 items. Dates ISO. IDs UUID (bad UUID gives 404).
- `middleware/errors.js`: last in `app.js`; uses `err.status` when set, else 500 `{ message: "Something went wrong" }`; log the real error. Replace every `res.status(500).json({ message: error.message })`.
- Deletes return 404 when nothing was deleted.

### B1. Rate limits
| Routes | Key | Limit |
|---|---|---|
| login, register, forgot, reset, check-email | IP (login also per email) | 10 / 15 min |
| `/api/ai/*` except tip | user | 30 / hour |
| everything else | user or IP | 300 / 5 min |
`app.set("trust proxy", 1)`. Response 429 `{ message: "Too many attempts. Try again in N minutes." }`. Disable in tests by env.

### B3. Session revocation
- `ALTER TABLE students ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;`
- JWT payload `{ id, email, tv }`. Middleware selects `id, token_version`; mismatch gives 401. A token without `tv` counts as 0.
- Password change and reset increment it. `PUT /api/auth/password` returns `{ message, token }`; settings page stores the new token.
- Frontend: any 401 from a signed-in request clears the token and goes to `/login`.

### B6. Whiteboards
Remove the file fallback and `dbPath`. Database error gives the central 500. The editor shows "Could not save" with retry.

### D1. Deployment
- `frontend/vercel.json`: rewrite `/api/:path*` to `https://<render-host>/api/:path*` (placeholder documented).
- `lib/api.ts`: `NEXT_PUBLIC_BACKEND_URL` empty string means same origin (use `??`, not `||`). Check other hard-coded `localhost:4000` uses (flashcards page).
- `Documents/DEPLOY.md`: order (Supabase, Render, Vercel), every variable (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `GROQ_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`, `NODE_ENV=production`, no `DEV_MODE`), smoke checks, rollback.

## Step 2: Promised features

### E1. Recent Activity
**SQL** `activity_log`: `student_id`, `type TEXT NOT NULL`, `title TEXT NOT NULL`, `entity_id UUID`.
**Service** `services/activity.js`: `logActivity(studentId, type, title, entityId)`; try/catch, never throws. For completion events skip if the same `(type, entity_id)` already exists.
**Hooks:** tasks POST (`task_created`), tasks PUT to completed (`task_completed`), notices POST, quiz submit, flashcard deck POST, whiteboard POST.
**API** `GET /api/activity/recent?limit=20` returns `{ items: [{ id, type, title, entity_id, created_at }] }`.
**UI** `RecentActivityWidget`: icon and verb per type, relative time, link to the page; loading, empty, error with retry. Remove `AutomationLog` type and `automation_logs` writes; drop that table only after asking.
**Edge:** deleted items stay in the log; link goes to the list page.

### E2. Priority
**SQL** `tasks.importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('low','normal','high'))`.
**API** tasks POST and PUT accept `importance`.
**Logic** `src/lib/priority.ts` as in BUILD_PLAN; reasons: "Overdue", "Due today", "Due tomorrow", "Due in N days", plus " · marked important".
**UI** badge with text (not colour only), importance select in the modal, sort control remembered in `localStorage`.
**Tests** days -1, 0, 1, 3, 4, 7, 8 for each importance; completed; cancelled.

### E5. Task improvements
**SQL** replace status check with `('pending','in_progress','completed','cancelled')`; `repeat TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','weekly'))`; `repeat_parent UUID REFERENCES tasks(id) ON DELETE SET NULL`; unique index on `repeat_parent` where not null.
**API** completing a weekly task inserts a copy with deadline and reminder +7 days, `repeat_parent` = the completed id; the unique index makes it happen once. Response `{ task, nextTask? }`.
**Statuses to update:** types, filters, dashboard widgets, achievements, calendar feed (cancelled excluded).
**UI** search box (title and subject, client side), subject select, sort; undo delete with a 5s toast, then `DELETE`; leaving the page flushes the delete.

### E10. Calendar link
**SQL** `students.feed_version INTEGER NOT NULL DEFAULT 0`.
**API** HMAC over `calendar-feed:<id>:<version>`; `GET /api/calendar/feed-url`; `POST /api/calendar/feed-reset` increments and returns the new path.
**UI** Settings card "Calendar feed": copy button, how to subscribe, reset with confirmation. Warn that anyone with the link can read your tasks.
