# Handoff Report: Step 4 (Planning)

Branch: `build/step-4` (from `main` at `d85104b`)

## 1. Tasks

| ID | Task | Status | Commit |
|---|---|---|---|
| P8 | Workload warning | DONE | 15dacd1 |
| P1 | Task board | DONE | 37e1853 |
| P2 | Calendar page | DONE | ff0e9a0 |
| P4 | Search and command palette | DONE | 282853f |
| P5 | Daily recap | DONE | bd2b4f0 |

Commits are split by task; the branch was checked as a whole, not commit by commit.

## 2. Checks

- Backend `npm test`: 90/90
- Frontend `tsc --noEmit`: clean; `vitest`: 110/110; `next build`: passes
- ESLint: 135 problems (87 errors, 48 warnings), unchanged

## 3. SQL

None. `sql/migration-2026-11-28-lock-ai-functions.sql` from the earlier review still needs to be run if it has not been.

## 4. Environment and dependencies

No new variables. Added `cmdk` and `@dnd-kit/core` (approved). They were installed through
`registry.yarnpkg.com` because the owner's network resets `registry.npmjs.org`; the 28 new
lockfile hashes were compared against registry metadata. `@dnd-kit/sortable` was not needed.

## 5. How to test

- **Board:** Tasks > Board. Drag a card or use "Move to". Reload: the status stays. With the backend stopped, the card returns and a message appears. Cancelled tasks are not shown.
- **Calendar:** click a day: the form opens at 23:59 that day. Check Month, Week, the Tasks and Notices boxes.
- **Search:** Ctrl+K or "Search". Each result opens its item. Another account must see none of them; `GET /api/search` needs a token and 2 to 100 characters.
- **Recap:** dashboard shows overdue, today, next three, low attendance, cards due. Closing hides it until tomorrow.
- **Workload:** 3 open tasks on a day, or 6 in a Monday to Sunday week, shows a warning.

## 5b. Review fixes (CodeRabbit, PR 5)

Search is literal (regex match, checked read-only against Supabase), one board move per task at a time,
the task form is remounted per task and traps Tab, the palette restores focus, stale calendar loads are
ignored, `?open` waits for a successful load, and an unknown flashcard count is no longer shown as 0.
The interface fixes passed type check, tests and build but were not clicked through in a browser.

## 6. Not verified, and limits

- Keyboard use inside the palette (arrows, Enter, Escape). The test browser blocks key events before they reach React.
- Drag was tested with scripted mouse events, not by hand, and not on a touch screen.
- A rejected board move was simulated in the browser.
- Dark mode and 375px were checked on the dashboard, calendar, board and task list.
- Calendar timezone behaviour is unit tested in the machine's own timezone only.
- The sidebar now scrolls at about 735px window height; Settings sits below the fold.
