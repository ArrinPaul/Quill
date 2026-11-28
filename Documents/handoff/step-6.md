# Handoff Report: Step 6 (Groups)

Branch: `build/step-6` (branched from `main` at `a9aa711`)

---

## 1. Tasks Done and Not Done

All 6 Phase 6 tasks are **DONE**:

| Order | ID | Task | Status | Commit |
|---|---|---|---|---|
| 1 | C1 | Remove Telegram leftovers | DONE | `49216ab` |
| 2 | C2 | Email verification | DONE | `d08f9cc` |
| 3 | C3 | Groups and roles | DONE | `4ff0aca` |
| 4 | C4 | Invites | DONE | `8762547` |
| 5 | C5 | Block, report, remove | DONE | `8fa0232` |
| 6 | C6 | Groups UI | DONE | `0cd26de` |

Not done in Phase 6: **None** (Phase 7+ not started, per instructions).

---

## 2. Output of Every Check (Run After Final Code Commit `0cd26de`)

- **Backend tests (`npm --prefix backend test`):**
  - `tests 117`, `suites 24`, `pass 117`, `fail 0`, `cancelled 0`, `skipped 0`
- **Frontend typecheck (`cd frontend && npx tsc --noEmit`):**
  - Exited with code `0` (`0` errors)
- **Frontend unit tests (`cd frontend && npx vitest run`):**
  - `Test Files 12 passed (12)`, `Tests 123 passed (123)`
- **Frontend lint (`cd frontend && npx eslint src`):**
  - `133 problems (86 errors, 47 warnings)` (down from baseline `87 errors, 48 warnings, 135 total`)
- **Frontend production build (`cd frontend && npx next build`):**
  - Exited with code `0` (`23` static/dynamic routes compiled cleanly, including `/dashboard/groups`, `/dashboard/groups/[id]`, `/join/[code]`)
- **Live Supabase + `next start` regression pass (ports 4000 & 3000, temporary `qa.6.*@example.com` accounts deleted afterwards):**
  - 8 frontend routes (`/`, `/login`, `/signup`, `/dashboard`, `/dashboard/groups`, `/dashboard/groups/[id]`, `/join/[code]`, `/dashboard/settings`) returned `200`
  - **C1:** Live `.ics` calendar feed still returned `200` (`BEGIN:VCALENDAR`)
  - **C2:** Unverified user refused on `POST /api/groups` (`403`); `POST /api/auth/verify/send` (`DEV_MODE=true` `devCode`), wrong code (`400`), and valid code (`200`) verified
  - **C3:** Group create (`201`), non-member (`404`), and `GET /api/groups/:id/members` omitting `email` verified
  - **C4:** Invite create (`201`), `GET /api/invites/:code` (`200`), and `POST /api/invites/:code/accept` (`200`) verified
  - **C5:** Member report (`201`), remove+ban (`200`), immediate access loss (`404`), banned rejoin refusal (`403`), and `GET /api/groups/:id/audit` (`200`) verified

---

## 3. SQL Migrations (in Order) — Already Run by Owner

All 5 Phase 6 migrations were reviewed and executed by the owner in the Supabase SQL Editor:
1. `sql/migration-2026-11-28-c1.sql` (dropped legacy `reminders`, `events`, `group_members`, `telegram_groups`, `create_event_reminders()`, and `students.telegram_chat_id`; deleted 5 old Telegram SQL files)
2. `sql/migration-2026-11-28-c2.sql` (`students.email_verified_at` + backfill of existing students + `email_codes` table)
3. `sql/migration-2026-11-28-c3.sql` (`study_groups`, `study_group_members`, `idx_study_group_one_owner`, `join_study_group` with `FOR UPDATE` + 75-member limit + `REVOKE EXECUTE` + `SET search_path`)
4. `sql/migration-2026-11-28-c4.sql` (`study_group_invites`, `accept_study_group_invite` atomic 75-member join + `REVOKE EXECUTE` + `SET search_path`)
5. `sql/migration-2026-11-28-c5.sql` (`blocks`, `reports`, `audit_log`, `study_group_bans`, and ban-aware `join_study_group` / `accept_study_group_invite`)

*(Note: `sql/seed_dev_user.sql` was left untouched; `sql/setup.sql` was updated to match all 5 migrations.)*

---

## 4. New Settings / Environment

- **No new required env variables.**
- **Email verification (`C2`):** Uses existing `RESEND_API_KEY` and `EMAIL_FROM`. When Resend is unconfigured, `POST /api/auth/verify/send` returns `devCode` if `DEV_MODE=true` and `NODE_ENV !== "production"`, or `503` otherwise.
- **New password rule (`C2`):** Minimum 8 characters for new signups, password resets, and password changes (existing accounts with shorter passwords can still log in).

---

## 5. How to Test Each Task by Hand (Including What Should Be Refused)

1. **C1 (Telegram cleanup):** Confirm `sql/add_telegram_chat_id.sql`, `notifyme-migration.sql`, `reminders-migration.sql`, `seed_test_group.sql`, `update_rbac_to_user_ids.sql` are deleted, and `/api/calendar/feed/:id` still downloads `.ics`.
2. **C2 (Email verification):**
   - Sign up a new account (must be >= 8 chars, strength meter visible). Observe dashboard verification banner.
   - Try `POST /api/groups` while unverified -> **refused with 403**.
   - Go to Settings -> `"Email verification"` -> Send code -> enter wrong 6-digit code -> **400** (stays signed in); enter 5 wrong codes -> locked until new code; enter valid code -> verified, banner disappears.
3. **C3 (Groups & roles):**
   - Create a group on `/dashboard/groups` (`POST /api/groups`).
   - Test with a second account (non-member): `GET /api/groups/:id` and all `:id/*` routes -> **404**.
   - Test member vs admin vs owner permissions: member gets **403** on `PATCH /api/groups/:id`, `POST /invites`, `GET /reports`; `GET /members` never contains `email`; owner cannot leave without transferring ownership first.
4. **C4 (Invites):**
   - Admin creates invite -> copy 1-time code / `/join/<code>` link.
   - Open `/join/<code>` while logged out -> redirects to `/login?redirect=/join/<code>` and returns after login.
   - Test invalid, expired, revoked, and exhausted codes -> **404 `"Invite not found or expired"`**.
   - 75th member joins (`200`); 76th gets **409**.
5. **C5 (Safety):**
   - Member reports an issue/member; admin views/resolves on Settings tab.
   - Admin removes+bans a member -> removed member immediately gets **404** on group routes and **403** when trying to rejoin via invite until unbanned.
   - Owner views Audit Log on Settings tab (`403` for admin/member).
6. **C6 (Groups UI):**
   - Check Sidebar `"Groups"` -> `/dashboard/groups` and `/dashboard/groups/[id]` tabs (Overview, Members, Shared, Settings) at `375px` and `1440px`, light & dark mode, and keyboard (`Tab` / `Escape` inside modals).

---

## 6. What Could Not Be Verified

- **Resend live email delivery (`C2`):** Resend is not configured, so verification code sending was tested with `DEV_MODE=true` (`devCode`) and mocked `sendVerificationCode` in `node --test`.
- **Concurrent 75th/76th DB row locking (`C3`, `C4`):** Verified with `fakeSupabase.js` in `backend/test/invites.test.js` and by SQL inspection (`FOR UPDATE`); Postgres transaction serialization under concurrent live load was not stress-tested.
- **Visual browser rendering at `375px` & `1440px`, light/dark mode, and keyboard Tab/Escape traversal (`C2`, `C4`, `C6`):** Checked by code inspection (`useFocusTrap`, `useEscape`, semantic Tailwind tokens, `next build`), not in a headless browser.
