# Handoff Report: Step 2 (Promised Features)

Branch: `build/step-2` (branched from `build/step-1` at `8b47a2f`)

---

## 1. Tasks Done and Not Done

All 4 Phase 2 tasks are **DONE**:

| Order | ID | Task | Status | Commit |
|---|---|---|---|---|
| 1 | E1 | Recent Activity | DONE | `e2a0a42` |
| 2 | E2 | Priority score | DONE | `7d4ef85` |
| 3 | E5 | Task improvements | DONE | `93a0c9f` |
| 4 | E10 | Calendar link | DONE | `9dc8f4a` |

*(Also committed on `build/step-2`: `b4c75c1` adding `.coderabbit.yaml` and updating `Documents/agents/ORCHESTRATOR.md` for CodeRabbit PR review.)*

Not done in Phase 2: **None** (Phase 3+ not started, per instructions).

---

## 2. Output of Every Check (Run After Final Code Commit `9dc8f4a`)

- **Backend tests (`npm --prefix backend test`):**
  - `tests 54`, `suites 12`, `pass 54`, `fail 0`, `cancelled 0`, `skipped 0`
- **Frontend typecheck (`cd frontend && npx tsc --noEmit`):**
  - Exited with code `0` (`0` errors)
- **Frontend unit tests (`cd frontend && npx vitest run`):**
  - `Test Files 4 passed (4)`, `Tests 88 passed (88)` (includes 22 boundary tests in `src/lib/__tests__/priority.test.ts`)
- **Frontend lint (`cd frontend && npx eslint src`):**
  - `152 problems (94 errors, 58 warnings)` (down from Phase 1's `156`, well within `<= 94 errors / 64 warnings / 158 total`)
- **Live Supabase + Next.js regression pass (ports 4000 & 3000, temporary `qa.2.regression.*@example.com` account deleted afterwards):**
  - 10 frontend routes (`/`, `/login`, `/dashboard`, `/dashboard/tasks`, `/dashboard/notices`, `/dashboard/attendance`, `/dashboard/flashcards`, `/dashboard/quiz`, `/dashboard/whiteboard`, `/dashboard/settings`) returned `200`
  - **E1:** `task_created` & `task_completed` logged in `activity_log` and returned by `GET /api/activity/recent`, with `task_completed` deduplicated on re-completion
  - **E2 & E5:** `importance: "high"`, `status: "in_progress"`, `repeat: "weekly"` persisted; completing created `nextTask` with `repeat_parent`; un-completing and re-completing created no duplicate; `cancelled` excluded and `in_progress` included in `.ics` feed
  - **E10:** `POST /api/calendar/feed-reset` returned a new feed path, old link returned `401`, new link returned `200` (`BEGIN:VCALENDAR`)

---

## 3. SQL Files (in Order) — Already Run by Owner

All 4 Phase 2 migrations were reviewed and executed by the owner on Supabase:
1. `sql/migration-2026-11-27-e1.sql` (`activity_log` table, index, RLS, `service_role` grant)
2. `sql/migration-2026-11-27-e2.sql` (`tasks.importance` column + check constraint)
3. `sql/migration-2026-11-27-e5.sql` (`tasks_status_check` with `in_progress`, `repeat`, `repeat_parent`, partial unique index `idx_tasks_repeat_parent`)
4. `sql/migration-2026-11-27-e10.sql` (`students.feed_version`)

*(Note: `automation_logs` table in `sql/setup.sql` was preserved as instructed; ask owner before dropping.)*

---

## 4. New Environment Variables

- **None** added in Phase 2.

---

## 5. How to Test Each Task by Hand (Including What Should Be Refused)

1. **E1 (Recent Activity):**
   - Create a task, complete it, add a notice, submit a quiz, create a flashcard deck, and create a whiteboard.
   - Check Dashboard `RecentActivityWidget` and `GET /api/activity/recent?limit=20`: each action appears once with icon, verb, relative time, and link.
   - **Refused:** `GET /api/activity/recent` without token -> `401`; `?limit=101` -> `400`; another user sees none of your items.
2. **E2 (Priority score):**
   - Create tasks with `low`, `normal`, and `high` importance and deadlines today, tomorrow, in 5 days, and overdue.
   - Verify priority badge text (`High priority`, `Medium priority`, `Low priority`) + reason (`Due today`, `Overdue · marked important`, etc.) on `/dashboard/tasks` and Dashboard task widgets; toggle `"Sort by priority"` and reload to confirm `localStorage` persistence.
   - Check landing page (`/`) says `"ranks by urgency and importance"` (no `"AI ranks"`).
   - **Refused:** `POST /api/tasks` with `importance: "urgent"` -> `400`.
3. **E5 (Task improvements):**
   - Create a task with `status: "in_progress"` and `repeat: "weekly"`. Complete it -> verify `nextTask` is created for +7 days. Un-complete and re-complete -> verify **no duplicate** is created.
   - Search by title/subject, filter by subject, and sort on `/dashboard/tasks`.
   - Delete a task -> verify 5s undo toast restores it if clicked, or deletes on server after 5s / on leaving the page.
   - **Refused / excluded:** `cancelled` tasks do not appear in `/api/calendar/feed/:student_id`.
4. **E10 (Calendar link):**
   - Go to `/dashboard/settings` -> `"Calendar feed"` card. Copy the link and open it -> `.ics` calendar downloads (`200`).
   - Click `"Reset link"` -> confirm in dialog -> verify old link now returns `401` and new link returns `200`.
   - **Refused:** `POST /api/calendar/feed-reset` without token -> `401`.

---

## 6. What Could Not Be Verified / Known Problems

- **Visual browser rendering at `375px` & `1440px`, light & dark mode, and keyboard-only focus order:** Verified by static code inspection and Tailwind semantic tokens (`bg-card`, `text-foreground`, `border-border`, `useEscape`, `role="dialog"`), not via an automated headless browser screenshot pass.
- **Note on `build/step-2` base:** `build/step-2` was branched from `build/step-1` (PR #1) per owner request; once PR #1 merges to `main`, `build/step-2` can be merged or rebased cleanly onto `main`.
