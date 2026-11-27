# Quill Improvement Plan

Written 2026-11-27. A backlog and execution plan that a person or an AI agent can pick up without prior context.

## 1. Project facts

| Item | Value |
|---|---|
| App | Quill: student hub (tasks, notices, attendance, flashcards, quizzes, AI tools, whiteboard) |
| Frontend | `frontend/`: Next.js 16, React 19, Tailwind v4. Port 3000 |
| Backend | `backend/`: Express 4, plain JavaScript. Port 4000. Entry `src/index.js` |
| Database | Supabase (Postgres) through `supabase-js`. Schema: `sql/setup.sql` |
| AI / email | Groq (`GROQ_API_KEY`), Resend (`RESEND_API_KEY`, `EMAIL_FROM`) |
| Auth | Own email/password with JWT; token kept in `localStorage` (`Quill_token`) |
| Env | Root `.env` (backend), `frontend/.env.local`. Never commit either |
| Repo | https://github.com/ArrinPaul/Quill |
| Removed on purpose | Google OAuth, Telegram, n8n. Do not reintroduce |

**Run:** `node backend/src/index.js` and `npm --prefix frontend run dev`.
**Checks (in `frontend/`):** `npx tsc --noEmit`, `npx vitest run`, `npx eslint src`.
**Baseline:** typecheck clean, 63 tests passing (whiteboard utilities only), 158 lint problems, no backend tests, no CI.

The 2026-11-27 changes (dark mode, Google removal, security and bug fixes) were still awaiting a final browser check when this was written. Confirm it passed before starting.

## 2. Rules for every task

1. One task per branch (`task/<ID>-short-name`) and one pull request.
2. Read the project's `Rules.md` and `DESIGN.md` first. Next.js 16 differs from older versions; check the docs in `node_modules/next/dist/docs` before using an API.
3. Stay inside the task's files. Note other problems; don't fix them in the same change.
4. Add a test for any logic you change.
5. Done means: acceptance check passes, typecheck and tests pass, lint count does not rise.
6. Database changes: add a new `sql/migration-YYYY-MM-DD-<name>.sql`, update `sql/setup.sql`, and ask the owner before running anything on the live database. No destructive SQL without approval.
7. New paid services, new dependencies or deployment changes need the owner's approval.

## 3. Backlog

Priority: **P0** do before real users, **P1** high value, **P2** nice to have. Size: S (hours), M (1-2 days), L (3+ days).

### Phase 0: Safety net (do first, everything else depends on it)

| ID | Task | Where | Done when | P | Size |
|---|---|---|---|---|---|
| F1 | Backend API tests: split app from `listen`, use Node's test runner against a mocked database client | `backend/src`, `backend/test` | Auth, ownership checks and validation for every route are covered; `npm test` passes | P0 | M |
| F2 | CI: typecheck, tests, lint (no new problems) on every pull request | `.github/workflows` | A failing test blocks the pull request | P0 | S |
| F3 | Remove leftovers: `backend/fix*.js`, `frontend/refactor*.py`, `backend/supabase-schema.sql`, `whiteboards_db.json`, `ai-smart-buddy/` (owner to confirm), old Telegram tables and files in `sql/` | repo root, `sql/` | App runs, nothing references removed files | P1 | S |
| F4 | Update docs: README and `Documents/` still describe CampusFlow, Telegram and Google | `README.md`, `Documents/` | A new person can set up from the README alone | P1 | S |

### Phase 1: Backend hardening

| ID | Task | Where | Done when | P | Size |
|---|---|---|---|---|---|
| B1 | Rate limit login, register, forgot/reset password and AI routes | `index.js`, `routes/auth.js`, `routes/ai.js` | Repeated attempts get 429 | P0 | S |
| B2 | Validate every request body and ID with one schema library; central error handler that never returns raw database messages | all `routes/` | Bad input gives 400/404, never 500 | P0 | M |
| B3 | Revoke old sessions after password change or reset | `middleware/auth.js`, `routes/auth.js`, migration | Old token returns 401 after a reset | P0 | S |
| B4 | Move the session token to an httpOnly cookie with CSRF protection (needs a decision on deployed domains) | `middleware/auth.js`, `lib/api.ts`, `AuthContext.tsx` | No token readable from page JavaScript | P1 | M |
| B5 | Security headers and request size limits | `index.js` | Headers present; oversized bodies get 413 | P1 | S |
| B6 | Remove the local-file whiteboard fallback; report database errors instead | `routes/whiteboards.js` | No file writes; errors reach the user | P1 | S |
| B7 | Fail at startup on missing env values; structured logging; health check that tests the database | `index.js`, `services/` | Misconfiguration is obvious immediately | P1 | S |
| B8 | Pagination on list endpoints; fix per-row update loop in quiz submit; fail account deletion if any step fails | `routes/` | Large accounts load in pages | P2 | M |
| B9 | AI: per-user daily limit, timeouts, validate the JSON shape returned by the model | `services/groq.js` | Malformed output is rejected, usage is capped | P1 | M |

### Phase 2: Frontend quality

| ID | Task | Where | Done when | P | Size |
|---|---|---|---|---|---|
| U1 | Split oversized pages into components and hooks: flashcards (~1400 lines), landing (~1280), quiz (~890), whiteboard engine (~810) | those files | No file over ~400 lines, behaviour unchanged | P1 | L |
| U2 | One data-fetching approach with caching, shared loading, empty and error states | pages, `lib/api.ts` | Every failed request shows a message and retry | P1 | M |
| U3 | Clear the lint backlog; replace `any` | `frontend/src` | `eslint src` is clean | P1 | M |
| U4 | Accessibility: label all fields, focus trap and focus return in popups, keyboard order, contrast in both themes | all pages | Automated accessibility scan has no serious issues | P1 | M |
| U5 | Replace hard-coded colours with theme tokens (current dark mode partly relies on CSS overrides) | `globals.css`, components | No per-colour `.dark` overrides left | P2 | M |
| U6 | Replace `confirm()` with the in-app dialog; consistent toasts | pages | No browser dialogs | P2 | S |
| U7 | Mobile pass on every page and popup; test touch drawing on a real device | all pages, whiteboard | No horizontal scroll at 360px; drawing works by touch | P1 | M |
| U8 | Performance: lazy-load Mermaid and animation libraries; load pdf.js from the app bundle, not a CDN | landing, tools, flashcards, quiz | Smaller first load, measured before and after | P2 | M |
| U9 | End-to-end browser tests for sign-up, task, flashcard, quiz and whiteboard flows | `frontend/e2e` | Run in CI. Depends on F2 | P1 | M |

### Phase 3: Finish existing features

| ID | Feature | Improvement | Done when | P | Size |
|---|---|---|---|---|---|
| E1 | Recent Activity | Always empty. Build a real activity log, or remove the widget (owner decides) | Shows real actions, or is gone | P1 | M |
| E2 | Landing page | "Smart Priority Scoring" and similar claims have no matching feature; Privacy and Terms links are empty | Every claim is true; links work | P0 | S |
| E3 | Flashcards | "Due today" study mode; keep session progress after reload; rename and export decks | Only due cards can be studied | P1 | M |
| E4 | Quizzes | Offer short-answer questions (backend already supports grading); retake; review wrong answers | All three work and save | P1 | M |
| E5 | Tasks | Search, sort, priority field, subject filter, recurring tasks, undo delete | Each usable on mobile | P1 | M |
| E6 | Attendance | Edit a record, case-insensitive subject names, history per class, "can I skip tomorrow?" | History visible per subject | P2 | M |
| E7 | Notices | Search, file upload (PDF or image), turn a notice date into a task | One click creates a task | P1 | M |
| E8 | AI chat | Save conversations, stream replies, attach a document | History survives reload | P1 | M |
| E9 | Whiteboard | Thumbnails, duplicate board, PDF export, show save and load errors | Visible in the board list | P2 | M |
| E10 | Calendar feed | The feed exists but has no button. Add "Copy calendar link" and a way to reset the link | User can subscribe from Settings | P1 | S |
| E11 | Account | Email verification, export my data | Needs Resend set up | P1 | M |
| E12 | Focus timer | Keep running across pages and reloads; custom durations saved | Timer survives navigation | P2 | S |

### Phase 4: New features (confirm each with the owner first)

| ID | Feature | Done when | Depends on | P | Size |
|---|---|---|---|---|---|
| N1 | Email deadline reminders (scheduled job) | One reminder per task, can be turned off | B7, Resend | P1 | M |
| N2 | Timetable with class schedule, linked to attendance | Mark attendance from today's classes | E6 | P1 | L |
| N3 | Grades and CGPA tracker | Per-semester totals | F1 | P2 | M |
| N4 | Notes library that feeds flashcards, quizzes and chat | One upload reused everywhere | E8 | P1 | L |
| N5 | Installable app (PWA) with offline reading and push reminders | Installs on a phone | U7 | P2 | M |
| N6 | Global search | Finds tasks, notices, decks, boards | U2 | P2 | M |
| N7 | Study analytics: focus time, quiz scores, streaks | Charts from real data | E1 | P2 | M |
| N8 | Study groups: shared decks and boards | Roles and permissions tested | F1, B2 | P2 | L |

## 4. Execution order

```
F1, F2  ->  B1, B2, B3, E2  ->  Phase 2 + Phase 3 in parallel  ->  Phase 4
```

**Release gate before real users:** F1, F2, B1, B2, B3, E2, new Groq and Resend keys, rotated Supabase credentials, `FRONTEND_URL` and `NODE_ENV=production` set on the host.

## 5. Running agents in parallel

Give each agent one lane. Tasks inside a lane run one after another.

| Lane | Tasks | Owns |
|---|---|---|
| A: Backend | F1, B1, B2, B3, B5, B6, B7, B9, B8 | `backend/` |
| B: Study | E3, E4, E8 | flashcards, quiz, AI pages |
| C: Campus | E5, E6, E7, E10 | tasks, attendance, notices, settings |
| D: Platform | F2, F3, F4, E2, U9 | CI, docs, landing, tests |

- Use a separate git worktree per agent.
- A feature task that needs a backend route owns that route file; Lane A must not edit it at the same time (do B2 before lanes B and C start).
- `globals.css`, `lib/api.ts`, `sql/setup.sql` and `package.json` are shared: one agent at a time.
- Run U1, U3, U4, U5 **after** lanes B and C, one at a time, since they touch the same pages.
- B4 changes login everywhere: run it alone.

**Brief to give each agent:**

> Read `Documents/IMPROVEMENT_PLAN.md`. Do task `<ID>` only. Follow section 2. Report what changed, the output of the checks, what you could not verify, and any decision you need.

## 6. Decisions for the owner

1. Remove `ai-smart-buddy/`? (F3)
2. Build or remove Recent Activity? (E1)
3. Drop the priority-scoring claim, or build it? (E2)
4. Where will frontend and backend be hosted? (affects B4)
5. Which Phase 4 features do you want?
