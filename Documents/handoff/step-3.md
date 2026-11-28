# Handoff Report: Step 3 (Study)

Branch: `build/step-3` (branched from `main` at `7173658`)

---

## 1. Tasks Done and Not Done

All 5 Phase 3 tasks are **DONE**:

| Order | ID | Task | Status | Commit |
|---|---|---|---|---|
| 1 | B9 | AI limits and output checks | DONE | `0704cfa` |
| 2 | E3 | Flashcard study modes | DONE | `e47d9fe` |
| 3 | E4 | Quiz types and review | DONE | `7628eda` |
| 4 | E8 | Saved AI chat | DONE | `36b3000` |
| 5 | P3 | Notes | DONE | `bb2904d` |

Not done in Phase 3: **None** (Phase 4+ not started, per instructions).

---

## 2. Output of Every Check (Run After Final Code Commit `bb2904d`)

- **Backend tests (`npm --prefix backend test`):**
  - `tests 76`, `suites 16`, `pass 76`, `fail 0`, `cancelled 0`, `skipped 0`
- **Frontend typecheck (`cd frontend && npx tsc --noEmit`):**
  - Exited with code `0` (`0` errors)
- **Frontend unit tests (`cd frontend && npx vitest run`):**
  - `Test Files 6 passed (6)`, `Tests 96 passed (96)`
- **Frontend lint (`cd frontend && npx eslint src`):**
  - `135 problems (87 errors, 48 warnings)` (down from Phase 2's `152` and Phase 1's `158`)
- **Live Supabase backend regression pass (`http://localhost:4000`, temporary `qa.3.regression.*@example.com` deleted afterwards):**
  - **E3:** `PUT /api/flashcards/decks/:id` renamed deck (`200`)
  - **E4:** `POST /api/quizzes` omitted `correct_index` before submit; `PATCH /api/quizzes/:id/submit` ignored client `score: 0` and computed `100`; `POST /api/quizzes/:id/retake` reset `score: null` and hid `correct_index`
  - **E8:** `POST` (`201`), `PATCH` (`200`), and `DELETE` (`200`) on `/api/ai/conversations`
  - **P3:** `GET /api/notes` omitted `content`; `PUT /api/notes/:id` incremented `version` (`1 -> 2`) and returned `409` on stale `version: 1`

---

## 3. SQL Files (in Order) — Already Run by Owner

All 4 Phase 3 migrations were reviewed and executed by the owner on Supabase:
1. `sql/migration-2026-11-27-b9.sql` (`ai_usage` table, `bump_ai_usage`, `refund_ai_usage`)
2. `sql/migration-2026-11-27-e4.sql` (`quiz_questions` `type`, `model_answer`, `user_answer_text`, `feedback`, nullable `options`/`correct_index`)
3. `sql/migration-2026-11-27-e8.sql` (`ai_conversations`, `ai_messages`, indexes, RLS, `service_role` grants)
4. `sql/migration-2026-11-27-p3.sql` (`notes` table, index, RLS, `service_role` grants)

---

## 4. New Environment Variables

- **Optional backend env:** `AI_DAILY_LIMIT` (integer, defaults to `50` in `backend/src/middleware/aiQuota.js`).

---

## 5. How to Test Each Task by Hand (Including What Should Be Refused)

1. **B9 (AI limits & output checks):**
   - Set `AI_DAILY_LIMIT=2` temporarily, call `/api/ai/*` 3 times -> 3rd returns `429 { message: "Daily AI limit reached" }`.
   - Malformed model output or timeout -> returns `503`, saves nothing, and refunds the daily usage count.
2. **E3 (Flashcard study):**
   - Open `/dashboard/flashcards`, rename a deck -> `PUT /api/flashcards/decks/:id` updates title; another user gets `404`.
   - Click `"Study due (N)"` (disabled when `0` with next due time shown), reload mid-deck -> restores `{ cardId, mode }` from `Quill_deck_<id>`.
   - Click `"Export CSV"` -> cells starting with `=`, `+`, `-`, `@` are prefixed with `'`.
3. **E4 (Quizzes):**
   - Generate or create an `MCQ`, `True/False`, or `Short Answer` quiz. Inspect `GET /api/quizzes/:id` before submit -> `correct_index` and `model_answer` are omitted.
   - Submit quiz -> server grades & scores (ignoring client `score`). Review mistakes -> shows explanation, citation, model answer, and AI feedback. Click `"Retake Quiz"` -> clears answers.
4. **E8 (Saved AI chat):**
   - Open `/dashboard/ai`: create/rename/delete conversations, send message -> streams SSE (`delta`, `done`). Click `"Stop"` mid-stream or `"Retry"` on error. Reload -> history persists. Another user gets `404`.
5. **P3 (Notes):**
   - Open `/dashboard/notes` (via Sidebar / MobileNav): create note, write Markdown (including raw `<script>`/`<img onerror>` -> not executed in Preview), wait 2s for autosave.
   - Simulate stale `version` -> `409` conflict banner offers Reload or Overwrite.
   - Click Summarize / Expand / Suggest tasks -> preview only until clicked; `"Make flashcards"` / `"Make quiz"` opens those pages prefilled.

---

## 6. What Could Not Be Verified / Known Problems

- **Pre-existing `frontend/src/app/globals.css:243` CSS syntax error in `next dev`:** During the live frontend dev check, `GET /` returned `404` because Turbopack PostCSS failed on pre-existing line 243 (from commit `4ae914d`):
  `.dark :is(.text-primary, .hover:text-primary:hover)` (the colon in `.hover:text-primary` is unescaped; should be `\.hover\:text-primary:hover`). `globals.css` was not in Phase 3 task scope so it was not modified; recommend fixing before merging or in a quick follow-up.
- **Live Groq API calls & browser viewport checks (`375px` / `1440px`, light/dark, keyboard):** Backend AI flows were verified offline via `setCompleter`/`setStreamCompleter`; browser UI responsiveness and keyboard traversal were verified by code inspection and Tailwind semantic tokens.
