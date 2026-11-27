# Spec: Steps 6 to 9 (Groups, Sharing, Channels, Chat)

Read `00-conventions-and-steps-1-2.md` section 0 and `../COLLAB_PLAN.md` sections A and B first.
Decided: Telegram tables are dropped; **75 members per group**; 100 MB files per group (default, unconfirmed). No domain yet.

## Step 6: Groups

### C1. Remove Telegram leftovers
Remove the `group_members`/`events` code in `routes/calendar.js`, `routes/calendar.js` fan-out stub, `telegram_groups` fields in `CampusNewsWidget` and `UpcomingEventsWidget`. Migration drops `reminders, events, group_members, telegram_groups`, function `create_event_reminders`, `students.telegram_chat_id`. **Ask the owner before it is run.** Rewrite `sql/setup.sql` without them and delete the old Telegram SQL files.

### C2. Email verification
**SQL** `students.email_verified_at TIMESTAMPTZ`; `email_codes`: `student_id`, `code_hash`, `expires_at`, `attempts INT DEFAULT 0`.
**API** `POST /api/auth/verify/send` (1 per minute, 5 per day), `POST /api/auth/verify { code }`. 6 digits from `crypto.randomInt`, 10 minute life, 5 attempts, one active code. `/auth/me` returns `email_verified`.
**No email configured:** with `DEV_MODE=true` outside production return `devCode`; otherwise 503.
**UI** banner and settings card; password strength meter on signup, reset and change (minimum 8 for new passwords; existing ones keep working).

### C3. Groups and roles
**SQL**
- `study_groups`: `name TEXT NOT NULL` (3-60), `description TEXT` (500), `owner_id`, `realtime_key TEXT NOT NULL`.
- `study_group_members`: `group_id`, `student_id`, `role CHECK IN ('owner','admin','member')`, `joined_at`; unique pair; one owner per group (partial unique index).
- Function `join_study_group(p_group uuid, p_student uuid)` that locks the group row (`FOR UPDATE`), refuses at 75 members, inserts.
**Access** `services/access.js`: `requireMember(groupId, studentId, minRole='member')` returns membership or throws 404; wrong role throws 403 **only** to actual members.

| API | Who | Notes |
|---|---|---|
| `GET /api/groups` | signed in | my groups with role and member count |
| `POST /api/groups` | verified | caller becomes owner; max 20 owned |
| `GET /api/groups/:id` | member | includes `realtime_key` |
| `PATCH /api/groups/:id` | admin | name, description |
| `DELETE /api/groups/:id` | owner | body `{ confirmName }` |
| `GET /api/groups/:id/members` | member | id, name, branch, year, role. **Never email** |
| `PATCH /api/groups/:id/members/:sid` | owner | role |
| `DELETE /api/groups/:id/members/:sid` | admin, or self | admins cannot remove admins or owner; rotates key |
| `POST /api/groups/:id/transfer` | owner | `{ studentId }` |

Owner cannot leave without transferring. Account deletion: transfer to the oldest admin, then oldest member; delete the group if none.

### C4. Invites
**SQL** `study_group_invites`: `group_id`, `code_hash`, `created_by`, `expires_at`, `max_uses INT`, `uses INT DEFAULT 0`, `revoked_at`.
**API** `POST /api/groups/:id/invites` (admin; default 7 days, 25 uses; code returned once, 16 random base32 characters), `GET`, `DELETE /:inviteId`, `GET /api/invites/:code` (group name and count only), `POST /api/invites/:code/accept`. Same 404 message for invalid, expired, revoked. Use count and join happen in one transaction. 10 attempts per 15 min.
**UI** `/join/[code]` surviving the login redirect.

### C5. Safety
`blocks(blocker_id, blocked_id)`, `reports(reporter_id, group_id, target_type, target_id, reason, status)`, `audit_log(group_id, actor_id, action, target)`, `study_group_bans(group_id, student_id)` (removed-and-banned cannot rejoin). APIs: block/unblock; report; admins list and resolve reports; owner views the log.

### C6. UI
Sidebar "Groups"; `/dashboard/groups` and `/dashboard/groups/[id]` with tabs Overview, Members, Shared, Settings. Feature folder `features/groups`.

**Step 6 tests:** role matrix for every route; 75th join succeeds and 76th gets 409, including concurrent; removed member gets 404 at once.

## Step 7: Sharing

### C7
**SQL** `shares`: `group_id`, `resource_type CHECK IN ('note','deck','board','quiz')`, `resource_id`, `permission CHECK IN ('view','edit')`, `shared_by`; unique `(group_id, resource_type, resource_id)`.
**Access** `canAccess(type, id, studentId, need)`: owner, or a share in a group the student belongs to with enough permission. Every read and write route for those four types goes through it.

| Action | Owner | Edit | View |
|---|---|---|---|
| Read | yes | yes | yes |
| Change content | yes | yes | no |
| Delete, share, unshare | yes (group admin may unshare) | no | no |

Personal progress is **not** shared: move flashcard review state to `card_progress(card_id, student_id, status, repetitions, interval_days, ease_factor, next_review_at)` and quiz answers to `quiz_attempts` and `quiz_attempt_answers`; migrate existing data without loss before enabling deck or quiz sharing.
**API** `POST /api/shares`, `DELETE /api/shares/:id`, `GET /api/groups/:id/shares`. List endpoints keep returning own items; shared items come from the group endpoint.
**Concurrency** notes use `version` (409); boards get the same column.

### C8. Tags and export
`tags(student_id, name)`, `note_tags(note_id, tag_id)`; max 10 per note. Export `.md` download and a print stylesheet for PDF.

### C9. Copy deck
`POST /api/flashcards/decks/:id/copy` copies cards without progress.

## Step 8: Channels

### C10. Realtime signals
Backend `services/realtime.js`: `signal(topic, payload)` posting to Supabase Realtime Broadcast over HTTP with the secret key (check current docs); never include message text or names. Topic `group:<id>:<realtime_key>`. Frontend `lib/realtime.ts` uses `lib/supabase.ts`, subscribes, refetches on signal and on reconnect, polls every 15s while disconnected. Rotate keys on removal or leave; clients receiving 404 unsubscribe. Signal failure never fails the write.

### C11. Channels
`channels`: `group_id`, `name` (2-40, unique per group), `archived_at`. Creating a group creates `general`. Admin only for create, rename, archive. Max 50. Archived is read only.

### C12. Messages
**SQL** `chat_messages`: `channel_id`, `dm_id` (exactly one, check constraint), `author_id` (set null on account deletion), `body TEXT` (1-4000), `parent_id`, `client_id UUID NOT NULL`, `edited_at`, `deleted_at`; unique `(author_id, client_id)`; index `(channel_id, created_at DESC, id)`.
**API** `GET /api/channels/:id/messages?before=&after=` (50), `POST { body, clientId }` (repeat returns the existing message), `PATCH /api/messages/:id` (author), `DELETE` (author or group admin; soft delete, body cleared). 20 messages per 10s.
**UI** `/dashboard/groups/[id]/c/[channelId]`; newest at bottom; keeps scroll position when loading older; "new messages" pill; Enter sends, Shift+Enter newline; toolbar for bold, italic, code, link, list; safe Markdown, links `rel="noopener noreferrer nofollow"`.

### C13. Outbox
Pending messages in IndexedDB keyed by user, states sending, failed; retry with backoff; same `client_id`; cleared on logout.

## Step 9: Chat features

### C14. Threads, reactions, mentions, unread
`reactions(message_id, student_id, emoji)` unique, allow-listed emoji set; `mentions(message_id, student_id)` only members; `read_states(student_id, channel_id|dm_id, last_read_at)`. APIs: `PUT/DELETE /api/messages/:id/reactions/:emoji`, `GET /api/messages/:id/replies` (one level), `POST /api/channels/:id/read`, `GET /api/unread`. Mention picker; mentions stored from ids sent by the client and verified.

### C15. Direct messages
`dm_threads(student_a, student_b, realtime_key)` with ordered unique pair; `chat_messages.dm_id`. Only people sharing a group can start one; leaving all shared groups makes it read only; a block stops sending, presence and notifications both ways. `POST /api/dms { studentId }`, list, messages as C12.

### C16. Presence and status
`students.status CHECK IN ('available','busy','away','invisible')`, `status_text` (80), `show_presence BOOLEAN`. Realtime Presence on group topics with user id only; invisible users do not join presence. Typing signal throttled to 1 per 3s, expires after 5s. Block rules apply.

### C17. Attachments
Private bucket `chat`. `attachments(message_id, uploader_id, group_id, path, name, size, mime)`. `POST /api/attachments/sign-upload { name, size, mime, channelId }` then upload, then reference ids in the message; `GET /api/attachments/:id/url` (60s). Types: png, jpg, webp, gif, pdf, txt, md, docx, pptx, xlsx; 5 MB; 100 MB per group counted server side; verify size after upload; random stored names; delete objects with messages, accounts and groups; cleanup job for unused uploads.

### C18. Notifications
`notifications(student_id, type, actor_id, group_id, link, read_at)`, `notification_prefs(student_id, type, in_app, email, push)`, `push_subscriptions(student_id, endpoint, keys)`. Types: mention, reply, dm, group_invite, task_assigned, report. Bell with unread count; email only if unread after 15 minutes (cron job as N1); web push with `web-push` and VAPID keys, payload without message text. Defaults: in-app on, email and push off.

**Steps 8-9 tests:** stranger and removed member against every id; duplicate send; reconnect with no gaps; blocked user; script and `javascript:` links render harmless.
