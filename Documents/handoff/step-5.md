# Handoff Report: Step 5 (Later)

Branch: `build/step-5`, created from `build/step-4` (PR 5). Merge PR 5 first.
The owner approved N1, P6, P7, P10 and P11. P9 is built later as C2, P12 as C31.

## 1. Tasks

N1 email reminders, P6 weekly digest, P7 reports, P10 share links, P11 installable app: built.

## 2. Checks

- Backend `npm test`: 97/97
- Frontend `tsc` clean, `vitest` 110/110, `next build` passes
- ESLint: 87 errors / 48 warnings, unchanged

## 3. SQL (run BEFORE using this branch)

`sql/migration-2026-11-28-step5.sql`. Without it, reports, sharing and email settings fail, focus
history is not kept, and saving a task with a changed reminder time fails.

## 4. New settings

- `CRON_SECRET` on the backend and as a GitHub secret; GitHub variable `BACKEND_URL`.
- Sending email also needs `RESEND_API_KEY`, `EMAIL_FROM` and a verified domain.
- New dependency: `recharts`.

## 5. Behaviour to know

- Focus sessions are now limited to 1 to 180 whole minutes.
- A share link is shown once. Creating a new one turns the old one off.
- The unsubscribe link and share pages rely on the web host forwarding `/api` (see `frontend/vercel.json`).
- Quiz scores are dated by when the quiz was created; there is no submission date.
- Email times are written in UTC.
- Digest and reminder runs handle 50 per run.

## 6. Not verified

- Nothing that needs the new tables has been run against Supabase or clicked through: reports,
  share dialog and page with real data, email settings.
- No email has been sent through Resend; the provider is faked in tests.
- The scheduled GitHub workflow has not run.
- Installing on a phone and the update prompt. The service worker, cache contents and manifest were
  checked in a desktop browser.
