# Spec: Step 3 (Study), Step 4 (Planning), Step 5 (Later)

Read `00-conventions-and-steps-1-2.md` section 0 first.

## Step 3: Study

### B9. AI guardrails
**SQL** `ai_usage`: `student_id`, `day DATE`, `count INTEGER`; unique `(student_id, day)`. Increment atomically with a SQL function `bump_ai_usage(p_student uuid, p_limit int) returns boolean`.
**Backend** `middleware/aiQuota.js` on every AI route (limit `AI_DAILY_LIMIT`, default 50; 429 "Daily AI limit reached"). 30s timeout in `services/groq.js` `complete`. zod schemas for flashcards `[{front,back,citation?}]` (1-30), quiz (options count by type, `correctIndex` in range), grade `{score 0-100, feedback, isCorrect}`; failure raises `AIError`. A failed call refunds the count.

### E3. Flashcard study
- Rename: `PUT /api/flashcards/decks/:id { title }`.
- Due = `next_review_at <= now` or never reviewed. Button "Study due (N)", disabled at 0 with next due time.
- Position: `localStorage` `Quill_deck_<id>` `{ cardId, mode }`; ignored if the card is gone.
- Export deck as CSV; escape cells starting `= + - @`.
- Keep the existing SM-2 logic; add unit tests for it.

### E4. Quizzes
**SQL** `quiz_questions.type TEXT NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq','tf','short'))`, `model_answer TEXT`, `user_answer_text TEXT`, `feedback TEXT`; allow `options` and `correct_index` null for short.
**API** submit sends `{ answers: [{ question_id, user_answer_index?, user_answer_text? }] }`. The **server** computes correctness and score (grading short answers with the model); ignore client `score` and `is_correct`. `POST /api/quizzes/:id/retake` clears answers.
**UI** type selector (MCQ, True/False, Short), review screen listing mistakes with explanation and citation, retake.
**Edge** grading failure: nothing is saved, show retry. Do not send `correct_index` or `model_answer` before submission.

### E8. Saved AI chat
**SQL** `ai_conversations`: `student_id`, `title TEXT`, `updated_at`. `ai_messages`: `conversation_id`, `role TEXT CHECK (role IN ('user','assistant'))`, `content TEXT`.
**API** under `/api/ai/conversations`: GET list, POST, PATCH `/:id` (title), DELETE `/:id`, GET `/:id/messages`, POST `/:id/messages { content }` which streams the reply as `text/event-stream` (`data: {"delta"}`, then `data: {"done":true,"messageId"}`; errors `data: {"error"}`). Server builds history (last 20); clients never send system or assistant messages. Save the assistant message only on success.
**UI** conversation list (drawer on mobile), stop button, retry. Read the stream with `fetch` and a reader (needs the auth header). Verify streaming works through the Vercel rewrite; otherwise call Render directly for this route.

### P3. Notes
**SQL** `notes`: `student_id`, `title TEXT NOT NULL DEFAULT 'Untitled'`, `content TEXT NOT NULL DEFAULT ''` (max 100,000), `updated_at`, `version INTEGER NOT NULL DEFAULT 1`.
**API** `/api/notes`: list (no content), GET, POST, `PUT /:id { title, content, version }` (409 if version is old), DELETE. `POST /api/notes/:id/ai { action: summarize|expand|tasks }` returns a preview only.
**UI** `/dashboard/notes`: list, editor with write and preview tabs (`react-markdown` + `remark-gfm`, no raw HTML), autosave after 2s with flush on leave (follow `useAutoSave.ts`), conflict banner offering reload or overwrite. Buttons: make flashcards, make quiz (open existing flows with the text). Suggested tasks appear as a checklist with editable dates.

## Step 4: Planning

### P1. Task board
`@dnd-kit/core` and `@dnd-kit/sortable`. View toggle on tasks (`?view=board`). Columns `pending`, `in_progress`, `completed`; cancelled hidden. Order by priority then deadline (no manual ordering in this step). Move = `PUT /api/tasks/:id { status }`, optimistic with rollback toast. Each card has a "Move to" menu. Mobile: columns scroll horizontally with snap.

### P2. Calendar
`/dashboard/calendar`, month and week, built from `GET /api/tasks` and `/api/notices` (those with `event_date`). Pure date-grid functions in `features/calendar/lib` with tests (month edges, leap year). Parse `YYYY-MM-DD` as local, not UTC. Filters: tasks, notices. Click day opens the task modal with 23:59 that day. Extract the task modal into `features/tasks` so both pages use it.

### P4. Search and command palette
**API** `GET /api/search?q=` (2-100 chars) returns `{ results: [{ type, id, title, snippet, href }] }`, up to 5 per type: tasks, notices, notes, decks, boards, quizzes. Use `ilike` with `%` and `_` escaped; always filter by owner.
**UI** `cmdk` approved. Ctrl/Cmd+K and a sidebar button; pages and actions (new task, new note, toggle theme) plus results, debounced 250ms, cancel stale requests. Pages accept `?open=<id>` to select the item.

### P5. Daily recap
Dashboard card, client side: overdue, due today, next 3, attendance below threshold, flashcards due. Dismiss hides until tomorrow. No AI.

### P8. Workload warning
`features/tasks/lib/workload.ts`: open tasks only; heavy day >= 3, heavy week (Monday start) >= 6. Show on dashboard and calendar with text, not colour only.

## Step 5: Later (owner go-ahead per item)

### N1. Email reminders
**SQL** `students.email_reminders BOOLEAN NOT NULL DEFAULT false` (opt in); `tasks.reminder_sent_at TIMESTAMPTZ`.
**API** `POST /api/jobs/reminders`, header `x-cron-secret` compared in constant time to `CRON_SECRET`. Selects open tasks with `reminder_time <= now`, `deadline > now`, not sent; claim each with an update `WHERE reminder_sent_at IS NULL` before sending; clear on send failure. Batch 50. Changing the reminder resets `reminder_sent_at`.
**Job** `.github/workflows/reminders.yml` every 30 minutes (runs may be late). Wake retry for a sleeping server.

### P6. Weekly digest
`students.email_digest BOOLEAN DEFAULT false`, `last_digest_at`. Same job mechanism, Mondays. Signed unsubscribe link `GET /api/unsubscribe?token=` showing a confirm page that POSTs. Skip if there is nothing to report.

### P9. Email verification and password strength
Specified in `steps-6-9.md` C2.

### P7. Personal reports
`GET /api/reports/me?range=7|30|90`: tasks completed per week, on-time rate, quiz scores, attendance by subject, focus minutes. Focus history needs table `focus_sessions(student_id, minutes)` written by `/api/activity/focus` (reject outside 1-180). Page `/dashboard/reports`; `recharts` approved; each chart has a data table alternative.

### P10. Share links
`share_links`: `owner_id`, `resource_type CHECK IN ('note','deck')`, `resource_id`, `token_hash`, `revoked_at`. `POST/DELETE /api/share-links`; public `GET /api/public/:token` returns title and content only, rate limited. Page `/share/[token]` with `noindex`. Deleting the resource kills the link.

### P11. Installable app
Manifest, icons from the Quill logo, service worker caching static assets and an offline page only. **Never** cache `/api`. Update prompt on new version.

### P12. Assistant actions
Specified as C31 in `steps-10-13.md`.
