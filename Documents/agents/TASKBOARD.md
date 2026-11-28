# Task Board

Only the orchestrator edits this. Status: TODO, IN PROGRESS, BLOCKED, DONE, SKIPPED. Order within a phase is the order of work.

**Current phase: 5 (built and tested, except email delivery — pending review)**

## Phase 1: Foundation

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| F1 | Testable backend and API tests | DONE | e8a6d42 | `npm test` 33/33 pass; `tsc` 0 err; `vitest` 63/63; `eslint` 94 err / 64 warn (158) |
| F3 | Remove leftover files | DONE | ebaba52 | 23 leftover files deleted; `npm test` 33/33; `tsc` 0 err; `vitest` 63/63; `eslint` 158 |
| F2 | CI checks | DONE | ce23146 | `.github/workflows/ci.yml` added; Node 24, `npm test` 33/33, `tsc`, `vitest` 63/63, lint ceiling 94/64 |
| B2 | Validation and error handling | DONE | ab84b38 | `zod` validation, 404 UUID/delete checks, central 500 handler; `npm test` 37/37 |
| B1 | Rate limits | DONE | 37d6155 | `express-rate-limit` (auth/AI/general), `trust proxy`, 429 UI handling; `npm test` 42/42 |
| B3 | Session revocation | DONE | 387280a | `token_version` migration, JWT `tv`, middleware/reset/password bump, 401 redirect; `npm test` 44/44 |
| B6 | Remove whiteboard file fallback | DONE | a380b0d | Local fallback removed, 500 via error handler, editor retry UI; `npm test` 45/45 |
| D1 | Deployment setup and guide | DONE | e7039f5 | `vercel.json` rewrite, `API_BASE` `??`, `DEPLOY.md`; `vitest` 66/66; `eslint` 156 |

## Phase 2: Promised features

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| E1 | Recent Activity | DONE | e2a0a42 | `activity_log` migration run; `logActivity` + 6 hooks + widget; `npm test` 49/49 |
| E2 | Priority score | DONE | 7d4ef85 | `importance` migration run; `priorityOf` + 22 tests + UI sort/badges; `npm test` 50/50 |
| E5 | Task improvements | DONE | 93a0c9f | `in_progress` + `repeat` migration run; +7d unique index; search/filter/sort/undo UI; `npm test` 52/52 |
| E10 | Calendar link | DONE | 9dc8f4a | `feed_version` migration run; `feed-reset` + Settings card; `npm test` 54/54 |

## Phase 3: Study

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| B9 | AI limits and output checks | DONE | 0704cfa | `ai_usage` + `bump_ai_usage` run; 30s timeout, Zod output checks, 429/503; `npm test` 60/60 |
| E3 | Flashcard study modes | DONE | e47d9fe | `PUT /decks/:id`, Study due (N), `Quill_deck_<id>`, CSV escape, SM-2 tests; `npm test` 64/64 |
| E4 | Quiz types and review | DONE | 7628eda | `quiz_questions` migration run; server grading, retake, mistake review; `npm test` 66/66 |
| E8 | Saved AI chat | DONE | 36b3000 | `ai_conversations`/`ai_messages` migration run; SSE streaming + drawer; `npm test` 70/70 |
| P3 | Notes | DONE | bb2904d | `notes` migration run; 409 concurrency, autosave, AI preview, `/dashboard/notes`; `npm test` 76/76 |

## Phase 4: Planning

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| P1 | Task board | DONE | 37e1853 | Board view, drag, Move to, rollback |
| P2 | Calendar page | DONE | ff0e9a0 | Month and week, tasks and notices |
| P4 | Search and command palette | DONE | 282853f | `/api/search`, Ctrl+K; keyboard use not verified |
| P5 | Daily recap | DONE | bd2b4f0 | Dashboard card |
| P8 | Workload warning | DONE | 15dacd1 | Unit tested |

## Phase 5: Later (owner approves each)

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| N1 | Email reminders | DONE | build/step-5 | SQL run; email sending unproven, see handoff |
| P9 | Email verification (done as C2) | TODO | | |
| P7 | Reports | DONE | build/step-5 | SQL run; email sending unproven, see handoff |
| P6 | Weekly digest | DONE | build/step-5 | SQL run; email sending unproven, see handoff |
| P10 | Share links | DONE | build/step-5 | SQL run; email sending unproven, see handoff |
| P11 | Installable app | DONE | build/step-5 | SQL run; email sending unproven, see handoff |
| P12 | Assistant actions (done as C31) | TODO | | |

## Phase 6: Groups

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C1 | Remove Telegram leftovers | TODO | | |
| C2 | Email verification | TODO | | |
| C3 | Groups and roles | TODO | | |
| C4 | Invites | TODO | | |
| C5 | Block, report, remove | TODO | | |
| C6 | Groups UI | TODO | | |

## Phase 7: Sharing

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C7 | Share notes, decks, boards, quizzes | TODO | | |
| C8 | Tags and export | TODO | | |
| C9 | Copy shared deck | TODO | | |

## Phase 8: Channels

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C10 | Realtime signals | TODO | | |
| C11 | Channels | TODO | | |
| C12 | Messages | TODO | | |
| C13 | Outbox | TODO | | |

## Phase 9: Chat features

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C14 | Threads, reactions, mentions, unread | TODO | | |
| C15 | Direct messages | TODO | | |
| C16 | Presence and status | TODO | | |
| C17 | Attachments | TODO | | |
| C18 | Notifications | TODO | | |

## Phase 10: Group projects

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C19 | Group tasks | TODO | | |
| C20 | Board and blocking | TODO | | |
| C21 | Projects, milestones, sprints | TODO | | |
| C22 | Roadmap and Gantt | TODO | | |
| C23 | Group calendar | TODO | | |

## Phase 11: Meetings (choose provider first)

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C24 | Meeting links | TODO | | |
| C25 | Audio rooms | TODO | | |
| C26 | Recording and notes | TODO | | |
| C27 | Live transcript | TODO | | |

## Phase 12: Co-editing

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C28 | Spike | TODO | | |
| C29 | Notes co-editing | TODO | | |
| C30 | Whiteboard co-editing | TODO | | |

## Phase 13: Assistant and the rest

| ID | Task | Status | Commit | Evidence / notes |
|---|---|---|---|---|
| C31 | Assistant actions | TODO | | |
| C32 | Smart tools | TODO | | |
| C33 | Dashboard widgets | TODO | | |
| C34 | Reports | TODO | | |
| C35 | Imports | TODO | | |
| C36 | Integrations | TODO | | |
| C37 | Public pages | TODO | | |
| C38 | Installable app | TODO | | |

## Open questions for the owner

- Group file quota (100 MB assumed), before Phase 6
- Age and acceptable-use rules, before Phase 8
- Meeting provider and recording, before Phase 11
- Co-editing approach, after C28
