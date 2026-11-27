# Spec: Steps 10 to 13 (Projects, Meetings, Co-editing, Assistant and the rest)

Read `00-conventions-and-steps-1-2.md` section 0, `../COLLAB_PLAN.md` A and B, and `steps-6-9.md` (access and realtime) first.
Before building each of these steps, re-check this spec against the code and write any changes in the handoff.

## Step 10: Group projects

### C19. Group tasks
**SQL** extend `tasks`: `group_id` (null = personal), `project_id`, `sprint_id`, `assignee_id`, `parent_id`, `category TEXT`; for group tasks `student_id` is the creator. `task_comments(task_id, author_id, body)`. `group_categories(group_id, name)`.
**Rules** personal routes filter `group_id IS NULL`; update achievements, search, feed and reports so group tasks count only for the assignee. Subtasks one level. Assignee must be a member; removal unassigns.
**API** `GET/POST /api/groups/:id/tasks`, `PATCH/DELETE /api/tasks/:id` through access checks (delete: creator or admin), `GET/POST /api/tasks/:id/comments`.
**UI** group tab "Tasks": list and board, filters by assignee, category, project; task drawer with subtasks and comments; "Assigned to me" on the dashboard.

### C20. Board and blocking
Reuse P1. `task_links(blocker_id, blocked_id)`, same group, no self, cycle check by graph walk inside a transaction (409). Blocked badge; completing a blocked task asks to confirm.

### C21. Projects, milestones, sprints
`projects(group_id, name, description, start_date, end_date, status)`, `milestones(project_id, title, due_date, done_at)`, `sprints(project_id, name, start_date, end_date, status CHECK IN ('planned','active','closed'))`; one active sprint per project. Closing a sprint asks where unfinished tasks go (backlog or next). End date not before start. CRUD under `/api/groups/:id/projects` and `/api/projects/:id/...`; admins manage, members move tasks.

### C22. Roadmap, Gantt, diagram
Own SVG Gantt from task start (`created_at` or new `start_date`) to deadline, milestones as markers, day, week, month zoom, scrollable, with a table alternative. Dependency diagram with Mermaid in strict security mode; escape titles.

### C23. Calendar
`group_events(group_id, title, starts_at, ends_at, location, meeting_url, created_by)`. Filters personal, group, project. Signed feed adds events and assigned tasks of current groups only.

## Step 11: Meetings
**Stop first:** present provider options with current free limits to the owner.

### C24
`meeting_url` on group events; accept `https:` only; show the domain before opening.

### C25. Rooms
`meetings(group_id, channel_id, room_name, started_by, started_at, ended_at, recording boolean)`. `POST /api/groups/:id/meetings`, `POST /api/meetings/:id/token` (members; short-lived, identity from server), `POST /api/meetings/:id/end` (starter or admin). Provider keys server side. Mute, leave, participant list, device choice, permission-denied state. Removed members are disconnected.

### C26. Recording, transcription, notes
Everyone sees a recording indicator and must accept before audio is captured; start is logged. Upload to private storage (size cap from provider and storage limits), transcribe with Groq speech-to-text (check current file limits; split if needed), `meeting_notes(meeting_id, transcript, summary, action_items jsonb)`. Delete audio after success unless kept. AI action items become tasks only on click. Failure keeps the audio and offers retry for 7 days.

### C27. Live transcript
Only if C26 is stable and limits allow; chunked upload; label it approximate.

## Step 12: Co-editing

### C28. Spike (report only, 2 days)
Compare (a) Yjs over Supabase private broadcast channels with backend-signed tokens, (b) a hosted collaboration service free tier. Prove: non-member refused, viewer cannot write, removed member disconnected, persistence, reconnect. Owner chooses. Topic secrecy alone is **not** enough here because content travels.

### C29. Notes
Editor binding (for example CodeMirror with Yjs, needs approval), `notes.ydoc BYTEA`, debounced server snapshot that also writes `content` for search and export, remote cursors with names, offline edits merge.

### C30. Whiteboard
Map of shapes by id in Yjs; adapt `useCanvasEngine` so local changes become operations; per-user undo; throttle cursor updates to 10 per second; images stored in storage, not in the document. Existing boards convert on first open, original JSON kept. Keep existing whiteboard tests passing and add convergence tests.

## Step 13

### C31. Assistant actions
Server-side tool list: search (via the access layer), list tasks, draft task, note, deck, event. Read tools run; write tools return a **proposal** `{ id, kind, payload }` stored in `assistant_actions(student_id, kind, payload, status)`; `POST /api/ai/actions/:id/confirm` validates again and executes once. Treat all retrieved text as data: it cannot trigger tools without confirmation. Log every call. Limit 5 tool steps per message.

### C32. Smart tools
`POST /api/ai/summarize { type: 'channel'|'thread'|'note', id }` after access check, capped input; suggestions; natural-language search over `/api/search`; diagram and flowchart returning Mermaid (strict mode) or whiteboard shapes (validated).

### C33. Dashboard widgets
Mentions, recent notes, group activity, assigned tasks, workload. Each loads and fails on its own.

### C34. Reports
Personal (P7) plus group: tasks completed, on-time rate, channel message volume, active members. Members see aggregates; per-person detail only for their own, admins see task counts only, never message content analysis.

### C35. Imports
`import_jobs(student_id, source, status, counts jsonb, error)`. Sources: Todoist and Linear (CSV or export file; or personal token used once, never stored or logged), Slack export ZIP into a new channel (owner or admin). Preview before writing; `external_id` unique per source for re-runs. ZIP: 20 MB, max entries, max unpacked size, reject `..` paths. Slack authors appear as imported names, not Quill accounts.

### C36. Integrations
`webhooks(group_id, url, secret, events[])`, admin only. HTTPS, resolve and refuse private, loopback and link-local addresses at delivery time, no redirects, 5s timeout, HMAC signature header, 3 retries, disable after repeated failure. `.ics` URL subscription import with the same network rules.

### C37. Public pages
`/features`, `/about`, `/contact` (mailto or a rate-limited form), `/privacy`, `/terms`; fix footer links. Privacy lists Supabase, Render, Vercel, Groq, Resend and what each receives. Owner approves text; mark it as not legal advice.

### C38. Installable app
As P11, plus push registration from C18.

## Owner decisions still open
File quota (default 100 MB), minimum age and use rules (before Step 8), meeting provider and video (Step 11), recording (Step 11), co-editing choice (after C28).
