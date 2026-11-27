# Quill Collaboration Plan (Steps 6 to 13)

Written 2026-11-27 for builder and reviewer agents with no earlier context.
Continues `Documents/BUILD_PLAN.md` (Steps 1 to 5). Its rules (section 1), handoff report (section 7) and reviewer checklist (section 8) apply here too.

## A. Context

### A1. What Quill is today
A **single-user** student app: tasks, notices, attendance, flashcards, quizzes, AI tools, whiteboard, focus timer, achievements. Every table row belongs to one `student_id` and no user can see another's data. This plan adds **sharing between users**, which changes the security model. That is the main risk.

### A2. How it is built
| Part | Detail |
|---|---|
| Frontend | `frontend/`, Next.js 16 App Router, React 19, Tailwind v4, tokens in `app/globals.css`, dark mode via `.dark`. Pages in `src/app/(dashboard)/dashboard/*`, features in `src/features/*`, API client `src/lib/api.ts` |
| Backend | `backend/`, Express 4, plain JavaScript, one file per area in `src/routes/`. `req.student = { id, email }` from `middleware/auth.js` |
| Database | Supabase Postgres. Only the backend reads and writes, with the secret key (bypasses row level security). RLS is on for all tables with no policies for the public key. Schema `sql/setup.sql` |
| Auth | Quill's own email/password and JWT. **Not Supabase Auth**, so `auth.uid()` is empty |
| Supabase client | `frontend/src/lib/supabase.ts` exists with the publishable key; nothing imports it yet |
| AI / email | Groq, Resend |
| Hosting | Free tiers: Vercel, Render, Supabase |

### A3. Traps
- Tables `telegram_groups`, `group_members`, `events`, `reminders` are **leftovers from the removed Telegram feature**. `routes/calendar.js` still reads two of them. Do not reuse them. New tables start with `study_`. Remove the leftovers in Step 6.
- Google OAuth, Telegram and n8n were removed on purpose. Do not add Google or other OAuth sign-in or imports.
- Render free instances sleep and have temporary disks: no WebSocket server there and no files on disk.
- Before using any free service limit or API, read its current documentation. Do not rely on remembered numbers.

### A4. Prerequisites
Steps 1 to 4 of `BUILD_PLAN.md` merged (needs: tests, validation, rate limits, session revocation, notes, task board, calendar, search). Step 5 items P9 (email verification) and P11 (PWA) are pulled into Steps 6 and 13.

## B. Architecture decisions

### B1. One concept: the study group
Proddy's "workspaces", "channels members" and "teams" map to one thing: a **study group**. Group projects live inside it.

Roles: `owner` (all, including delete and transfer), `admin` (members, channels, moderation), `member`.

### B2. Authorization in one place
Add `backend/src/services/access.js`: `requireMember(groupId, studentId, minRole)`, `requireChannel(...)`, `canAccess(resource, studentId)`. Every group route calls it. Non-members get **404**, not 403. No route may check roles by hand.

### B3. Realtime without exposing data
Because Quill does not use Supabase Auth, the browser must never read tables directly.
- All reads and writes go through Express.
- After a write, the backend sends a **content-free signal** over Supabase Realtime Broadcast (for example `{type:"message", channelId, id}`). Clients then fetch from the API, which checks access.
- Topic names include a random `realtime_key` stored per group or conversation and returned only to members. Rotate it when someone leaves or is removed.
- Typing and presence use the same topics and carry only the user id.
- If the realtime connection fails, clients poll every 15 seconds.
- Co-editing (Step 12) is different because content must travel: do the spike there first.

### B4. Files
Private Supabase Storage bucket. Upload and download through short-lived signed URLs issued by the backend after an access check. Limit size (default 5 MB), allow-list types, per-group quota, delete the file when its row is deleted.

### B5. Safety (required before direct messages)
Block, report, remove member, delete message, group owner tools, rate limits on sending and invites, verified email needed to create or join groups. Render user text as text or safe Markdown: never raw HTML.

### B6. No OAuth
Imports use uploaded files or a personal API token that is used once and not stored.

## C. Data model

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, foreign keys with `on delete cascade`, RLS enabled, `GRANT ALL` to `service_role`, indexes on every foreign key.

| Table | Key fields | Step |
|---|---|---|
| `study_groups` | name, description, owner_id, realtime_key | 6 |
| `study_group_members` | group_id, student_id, role; unique pair | 6 |
| `study_group_invites` | group_id, code_hash, expires_at, max_uses, uses, revoked | 6 |
| `reports`, `blocks`, `audit_log` | who, target, reason / actor, action | 6 |
| `shares` | group_id, resource_type (note, deck, board, quiz), resource_id, permission (view, edit) | 7 |
| `channels` | group_id, name, archived | 8 |
| `conversations`, `conversation_members` | for direct messages; last_read_at. Name these `dm_*` to avoid the AI chat tables from E8 | 9 |
| `messages_chat` | channel_id or dm_id (exactly one), author_id, body, parent_id, edited_at, deleted_at | 8 |
| `reactions`, `mentions`, `read_states` | unique per user | 9 |
| `attachments` | message_id, path, name, size, mime | 9 |
| `notifications`, `notification_prefs` | recipient_id, type, link, read_at | 9 |
| `projects`, `milestones`, `sprints` | group_id, name, dates, status | 10 |
| `tasks` (extend) | group_id, project_id, sprint_id, assignee_id, parent_id, category | 10 |
| `task_comments`, `task_links` | author, body / blocker_id, blocked_id | 10 |
| `meetings`, `meeting_notes` | group_id, room, started_at / transcript, summary | 11 |
| `tags`, `note_tags` | per owner or group | 7 |

**Warning:** existing `tasks`, `notes`, `flashcard_decks`, `whiteboards` queries filter by `student_id`. Adding sharing means routing every one through `canAccess`. Do it table by table, with tests for owner, member, viewer, removed member and stranger.

## D. Steps

Sizes: S (hours), M (1-2 days), L (3 or more). Every item must meet BUILD_PLAN rule 9 (themes, mobile, keyboard, states).

### Step 6: Groups foundation (start here)
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C1 | Remove Telegram leftover tables and the code reading them (ask owner before the SQL; it drops tables) | Calendar feed still works | S |
| C2 | P9 email code verification | Unverified users cannot create or join groups | M |
| C3 | Groups: create, rename, delete, leave, transfer owner; roles; `access.js` | Role matrix fully tested | L |
| C4 | Invites: code and link, expiry, use limit, revoke; join page. Group limit 75 members | Expired, revoked or guessed codes fail; a 76th member is refused even when two join at once; rate limited | M |
| C5 | Block, report, remove member, audit log | Removed member loses access at once | M |
| C6 | Groups UI: sidebar entry, group home, members, settings | Usable at 360px | M |

### Step 7: Sharing (Notes, decks, boards, quizzes)
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C7 | Share to group with view or edit permission; "Shared with me" | Viewer cannot change; unshare removes access | L |
| C8 | Note tags, filter by tag, export as Markdown and PDF (browser print) | Export matches the note | M |
| C9 | Copy a shared deck into my own | Copies are independent | S |

### Step 8: Channels (Messaging, part 1)
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C10 | Realtime signal layer (B3) with polling fallback and key rotation | A removed member receives nothing useful and cannot fetch | M |
| C11 | Channels: create, rename, archive | Admin only | S |
| C12 | Messages: send, edit, delete, paginate, optimistic send with retry; safe Markdown composer with toolbar | No lost or duplicated messages after reconnect | L |
| C13 | Outbox: unsent messages kept locally and retried; client id for de-duplication | Survives reload and offline | M |

### Step 9: Chat features, direct messages, notifications, presence
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C14 | Threads, reactions, @mentions, unread counts | Counts correct across two devices | L |
| C15 | Direct messages between members of a shared group; blocking enforced | Blocked user cannot send or see presence | M |
| C16 | Typing indicator, online status, status picker, setting to hide status | Hidden means hidden at the API too | M |
| C17 | File attachments (B4) | Type, size and quota enforced; non-members cannot download | M |
| C18 | In-app notification centre, per-type settings, email through Resend, web push through the PWA service worker (VAPID, no third-party service) | Opting out is respected | L |

### Step 10: Group projects (Tasks, Boards, Projects, Calendar)
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C19 | Group tasks with assignees, categories, subtasks, comments, view toggle (list, board) | Personal tasks stay private | L |
| C20 | Group board reusing P1; blocking links with cycle check | A cycle is refused | M |
| C21 | Projects, milestones, sprints | A task belongs to at most one active sprint | L |
| C22 | Roadmap and Gantt view; dependency diagram with existing Mermaid | Dates match tasks | L |
| C23 | Calendar filters (personal, group, project), group events, group items in the signed feed | Feed never includes groups you left | M |

### Step 11: Meetings
**Owner decision needed first:** provider. Compare current free tiers of hosted WebRTC services (for example LiveKit Cloud) and a pasted meeting link. Do not build your own media server.
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C24 | Meeting link on a group event (works with no provider) | Link opens safely | S |
| C25 | Audio rooms; backend issues short-lived room tokens to members only | Non-members cannot join | L |
| C26 | Recording upload (size capped), transcription with Groq's speech-to-text, AI meeting notes and task suggestions | Everyone is told before recording; audio deleted after transcription unless kept on purpose | L |
| C27 | Live transcription | Optional; only if the free limits allow | L |

### Step 12: Live co-editing and cursors
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C28 | **Spike (timeboxed, report only):** Yjs over Supabase private channels with backend-signed tokens, versus a hosted service free tier. Show how access is enforced and revoked | Owner approves the choice | M |
| C29 | Co-editing for notes | Two editors, no lost text; viewers cannot write | L |
| C30 | Whiteboard co-editing and live cursors | Concurrent edits converge; undo affects only your changes | L |

### Step 13: Assistant, insight, imports, public pages
| ID | Build | Acceptance | Size |
|---|---|---|---|
| C31 | Assistant tools: search my and shared content, draft tasks, notes, events; confirm before writing; tool log | Cannot reach anything the user cannot | L |
| C32 | Smart tools: summarize a thread or channel, suggestions, AI search, diagram and flowchart from text | Uses the AI daily cap | M |
| C33 | Dashboard widgets: mentions, notes, group status, workload | Real data only | M |
| C34 | Reports: personal and group activity, performance, content charts | Members see aggregates, not private data | L |
| C35 | Imports: Todoist and Linear by file or one-time personal token; Slack from its export ZIP. Preview, then import | Re-running does not duplicate; zip is size and path checked | L |
| C36 | Integrations: outgoing webhooks to a user-provided URL and calendar feed subscribe (`.ics`) | Webhooks are signed and cannot target private network addresses | M |
| C37 | Public pages: features, about, contact, privacy, terms | Privacy text describes the real data handling; owner approves wording | M |
| C38 | Installable app and offline page (P11) | No private API responses cached | M |

**Focus timer:** already exists. Optional: shared group focus session (S), after C10.

**Until the domain exists:** build C2 so that, only with `DEV_MODE=true` outside production, the verification code is shown on screen (as password reset does). In production without email configured, group creation and joining stay disabled.

## E. Coverage of the requested features

| Requested | Where |
|---|---|
| Study groups, workspaces, roles, invites | C3-C6 |
| Channels, messages, rich text, outbox | C11-C13 |
| Threads, reactions, mentions, unread, typing | C14, C16 |
| Direct messages | C15 |
| File sharing | C17 |
| Presence, status, live cursors | C16, C30 |
| Audio and video rooms, transcription, recordings, meeting notes | C24-C27 (video depends on the provider chosen) |
| Tasks, assignees, categories | C19 |
| Kanban, Gantt, sub-lists, blocking, diagram, comments | C19, C20, C22 |
| Projects, sprints, roadmap, milestones | C21, C22 |
| Calendar | P2, C23 |
| Canvas and diagrams | existing, C30, C32 |
| Shared notes, decks, boards; co-editing; tags; export; share links | C7, C8, C29, P3, P10 |
| AI assistant and smart tools | E8, P12, C31, C32 |
| Dashboard, reports | P5, C33, C34 |
| Notifications | C18, N1, P6 |
| Accounts | P9 (C2) |
| Imports, integrations | C35, C36 |
| Public pages, offline | C37, C38 |
| Pomodoro | existing |

Not included: billing and a pricing page, since Quill is free.

## F. Order, parallel work and size

```
Steps 1-4  ->  6  ->  7  ->  8  ->  9  ->  10  ->  11, 12  ->  13
```
- Never parallel: anything touching `access.js`, auth, `sql/setup.sql`, `globals.css`.
- After Step 6: Step 7 and Step 10 may run in parallel with Step 8, in separate worktrees.
- This is **months of work**, much bigger than the current app. Release after Steps 7 and 9 and get real users' feedback before continuing.

## G. Briefs to give agents

**Builder:**
> You are extending Quill, a student web app, with group features. Read `Documents/COLLAB_PLAN.md` fully, then sections 1, 7 and 8 of `Documents/BUILD_PLAN.md`, `Rules.md` and `DESIGN.md`. Build Step <N> only, in ID order, on branch `build/step-<N>`. Non-members must never see group data: write the access test before each route. Do not run SQL on the live database, push to main, add OAuth, or add a paid service. Stop and ask when a decision is marked for the owner or the code does not match the plan. Finish with `Documents/handoff/step-<N>.md`.

**Reviewer:**
> Review `build/step-<N>` against `Documents/COLLAB_PLAN.md` and its handoff report. Test with at least four accounts: owner, member, removed member, stranger. Try to read and change group data by ID through the API. Ask before running SQL. Fix what fails and report.

## H. Owner decisions

| # | Decision | Needed before | Suggested |
|---|---|---|---|
| 1 | Drop the Telegram tables (data is lost) | Step 6 | **Decided: yes** |
| 2 | Maximum group size and file quota | Step 6 | **Decided: 75 members.** File quota 100 MB per group (default, not yet confirmed) |
| 3 | Domain for Resend email | Release of Step 6 | **No domain yet; owner will get one** |
| 4 | Minimum age and acceptable-use rules | Step 8 | Write before opening chat |
| 5 | Meetings provider, and video or audio only | Step 11 | Meeting links first |
| 6 | Allow recording | Step 11 | Off by default |
