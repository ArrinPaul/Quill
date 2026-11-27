# Quill Build Plan (for the builder agent)

You are building. A separate reviewer (Claude Code, run by the owner) tests and fixes after each step.
Background and reasons: `Documents/IMPROVEMENT_PLAN.md`. If the two disagree, this file wins.

## 0. Start here

**Prompt the owner gives you:**
> Read `Documents/BUILD_PLAN.md`. Build Step <N> only, task by task. Follow section 1. Stop at the end of the step and write the handoff report.

**Stack:** `frontend/` Next.js 16, React 19, Tailwind v4 (port 3000). `backend/` Express 4, plain JavaScript (port 4000). Supabase Postgres through `supabase-js`. Groq for AI, Resend for email. Own JWT auth.
**Run:** `node backend/src/index.js`; `npm --prefix frontend run dev`.
**Env:** root `.env`, `frontend/.env.local`. The owner fills these in.

## 0.1 Detailed specs (read the one for your step)

| Step | Spec |
|---|---|
| 1, 2 (and shared conventions, read always) | `Documents/specs/00-conventions-and-steps-1-2.md` |
| 3, 4, 5 | `Documents/specs/steps-3-5.md` |
| 6 to 9 | `Documents/specs/steps-6-9.md` |
| 10 to 13 | `Documents/specs/steps-10-13.md` |

Where a spec is more specific than a plan, the spec wins (for example, the spec names the AI chat tables and the chat message table).

## 1. Rules

1. Read `Rules.md` and `DESIGN.md`. Next.js 16 differs from older versions: check `frontend/node_modules/next/dist/docs` before using an API.
2. Branch per step: `build/step-<N>`, from up-to-date `main`. One commit per task: `<ID>: summary`. Do not push to `main` or merge.
3. Never commit `.env` files or print keys.
4. Do not bring back Google OAuth, Telegram or n8n.
5. Database: put changes in `sql/migration-<date>-<id>.sql` (idempotent) and add them to `sql/setup.sql`. Enable row level security on new tables and `GRANT ALL` to `service_role`. Never run SQL on the live database and never write destructive SQL: the owner runs it.
6. Every query on user data filters by `req.student.id`. Every new route uses `authMiddleware` unless this file says otherwise.
7. Validate input; return 400/404, never raw database errors.
8. AI or email failures must show an error. Never return made-up fallback content.
9. UI: works in light and dark (use `bg-card`, `text-foreground`, `border-border`, no hard-coded hex), at 360px width, by keyboard (`useEscape`, `lib/a11y.ts`), with loading, empty and error states.
10. Add a dependency only if this file names it or the owner agrees. Free services only.
11. If something here does not match the code, or needs a decision, stop and ask. Do not guess.

**Checks before every commit:** `npx tsc --noEmit` and `npx vitest run` pass in `frontend/`; `npm test` passes in `backend/` (after F1); `npx eslint src` problem count does not rise above 158.

## 2. Step 1: Foundation

| Order | ID | Build | Files | Acceptance |
|---|---|---|---|---|
| 1 | F1 | Move the app into `src/app.js` (export it); `index.js` only listens. Tests with `node:test`, database client mocked. Add `"test"` script | `backend/src`, `backend/test` | Tests cover register, login, every ownership check, and validation. No network needed |
| 2 | F3 | Delete `ai-smart-buddy/`, `backend/fix*.js`, `backend/supabase-schema.sql`, `backend/whiteboards_db.json`, `frontend/refactor*.py`. List the Telegram SQL files and ask before deleting any that `setup.sql` was built from | repo | Nothing references them. Keep the `automation_logs` table until E1 |
| 3 | F2 | GitHub Actions on pull requests: install, typecheck, both test suites, lint count limit | `.github/workflows/ci.yml` | Fails when a test fails |
| 4 | B2 | One validation approach (`zod` approved) and one error handler. UUID check on every `:id` | `backend/src` | Bad id or body gives 400/404, never 500 |
| 5 | B1 | `express-rate-limit` (approved): auth routes 10 per 15 min per IP, AI routes 30 per hour per user. Set `trust proxy` for Render | `app.js` | 429 with a readable message in the UI |
| 6 | B3 | Add `students.token_version INTEGER NOT NULL DEFAULT 0`; put it in the JWT; bump on password change and reset; middleware compares. Password change returns a fresh token | migration, `routes/auth.js`, `middleware/auth.js`, settings page | Old tokens get 401; the user who changed it stays signed in |
| 7 | B6 | Remove the local-file whiteboard fallback | `routes/whiteboards.js` | No filesystem writes |
| 8 | D1 | `vercel.json` rewrite of `/api/:path*` to the Render URL; frontend uses relative `/api` when deployed; check `render.yaml`; write `Documents/DEPLOY.md` with every env variable | `frontend/`, `render.yaml` | Local dev still works; guide is followable. Do not deploy |

## 3. Step 2: Promised features

### E1: Recent Activity
- Table `activity_log(id uuid pk, student_id uuid fk cascade, type text, title text, entity_id uuid, created_at timestamptz default now())`, index on `(student_id, created_at desc)`.
- `type`: `task_created`, `task_completed`, `notice_added`, `quiz_completed`, `deck_created`, `board_created`.
- Helper `services/activity.js`; a logging failure must not fail the user's action.
- `GET /api/activity/recent` returns `{ items: [...] }`, newest 20.
- `RecentActivityWidget.tsx` uses it; remove the `/api/automations` call and `automation_logs` code.
- **Accept:** each action appears once; another user sees none of it.

### E2: Priority score (rules, no AI)
- `tasks.importance TEXT CHECK (importance IN ('low','normal','high')) DEFAULT 'normal'`.
- Pure function `priorityOf(task, now)` in `frontend/src/lib/priority.ts` returning `{ level, score, reason }`:
  - completed or cancelled: no priority
  - base: overdue 100; due today 80; 1 day 70; 2-3 days 50; 4-7 days 30; later 10
  - importance: high +25, low -15
  - level: score >= 70 High, >= 40 Medium, else Low
- Use `daysUntil` from `lib/utils.ts`. Show badge and reason; add "Sort by priority" on tasks and the dashboard list; importance field in the task form.
- Landing copy: "ranks by urgency and importance". Remove any "AI ranks" wording.
- **Accept:** unit tests cover every boundary.

### E5: Task improvements
- Search by title, filter by subject, sort by deadline or priority.
- Status gains `in_progress` (needed by the board): update the check constraint by migration and every place that lists statuses.
- Weekly repeat: `tasks.repeat TEXT CHECK (repeat IN ('none','weekly')) DEFAULT 'none'`; completing creates the next one exactly once.
- Delete shows an undo toast; delete on the server only after it expires.
- **Accept:** un-completing and re-completing never creates duplicates.

### E10: Calendar link
- Settings card with "Copy calendar link" using `GET /api/calendar/feed-url` (exists), with the backend's public URL.
- Reset link: `students.feed_version INTEGER DEFAULT 0`, include it in the signature; `POST /api/calendar/feed-reset`.
- **Accept:** old link returns 401 after reset.

## 4. Step 3: Study

| ID | Build | Acceptance |
|---|---|---|
| B9 | 30s timeout; validate the model's JSON shape; table `ai_usage(student_id, day, count)` with a daily cap from `AI_DAILY_LIMIT` (default 50) | Cap gives 429; malformed output gives 503 and saves nothing |
| E3 | "Study due cards" using `next_review_at`; resume position after reload; rename deck | Only due cards shown |
| E4 | Short-answer option in the quiz form (needs columns for type and model answer); retake; review mistakes | Grading failure is shown, not scored |
| E8 | Tables `conversations`, `messages`; list, rename, delete chats; stream replies | History survives reload; other users get 404 |
| P3 | `notes(id, student_id, title, content text, updated_at)`; Markdown editor with preview (use existing `react-markdown`); autosave; AI summarize, expand, suggest tasks; "make flashcards / quiz from this note" | AI output is previewed and applied only on click. HTML in notes is not executed |

## 5. Step 4: Planning

| ID | Build | Acceptance |
|---|---|---|
| P1 | Board view on tasks: To do, In progress, Done. `@dnd-kit/core` approved. "Move to" menu for keyboard and touch | Move persists; failure rolls back with a message |
| P2 | `/dashboard/calendar`: month and week; tasks and notices; click a day to add a task | Correct across month ends and local timezone |
| P4 | Ctrl+K palette: pages, actions, search tasks, notices, notes, decks, boards via `GET /api/search?q=` | Own items only; fully keyboard usable |
| P5 | Dashboard daily recap: due today, overdue, subjects below attendance threshold (no AI) | Matches the source pages |
| P8 | Warn when 3 or more open tasks fall on one day or 6 in a week | Unit tested |

## 6. Step 5: Later (do not start without the owner)

| ID | Build | Note |
|---|---|---|
| N1 | Email deadline reminders: `POST /api/jobs/reminders` protected by `CRON_SECRET`, called by a GitHub Actions schedule; opt out in Settings; never send twice | Needs verified Resend domain |
| P6 | Weekly digest, same mechanism, signed unsubscribe link | After N1 |
| P9 | Email code at signup (hashed, expires, attempt limit), strength meter | Existing users stay verified |
| P7 | Reports page with charts | After E1 |
| P10 | Read-only share links, random token, revocable | After P3 |
| P11 | PWA manifest and offline page; never cache API responses with private data | |
| P12 | Assistant proposes tasks and decks; user confirms | After E8, B9 |
| E6, E7, E9, E11, E12, U1-U9 | As described in `IMPROVEMENT_PLAN.md` | |

## 7. Handoff report (required at the end of each step)

Write `Documents/handoff/step-<N>.md`:

1. Tasks done and not done, with commit hashes
2. Output of every check
3. SQL files the owner must run, in order
4. New env variables
5. How to test each task by hand, including what should be refused
6. What you could not verify, shortcuts taken, known problems

## 8. Reviewer checklist (for Claude Code after each step)

**Prompt:**
> Review branch `build/step-<N>` against `Documents/BUILD_PLAN.md` and `Documents/handoff/step-<N>.md`. Run the checks, ask me before running its SQL, test every task in the browser and by API, fix what fails, and report.

1. Read the diff; look for missing ownership filters, secrets, new dependencies.
2. Run checks and migrations, then each acceptance line with two accounts.
3. Light and dark, 360px, keyboard.
4. Regression pass: login, tasks, notices, attendance, flashcards, quiz, whiteboard, settings.
5. Fix, then report. Merge only when the owner says.

## 9. Collaboration features (Steps 6 to 13)

Groups, chat, sharing, projects, meetings and the other Proddy-derived features are planned in `Documents/COLLAB_PLAN.md`. Start them only after Steps 1 to 4 are merged.
