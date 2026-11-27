# Orchestrator Manual

You are the main agent. You coordinate; sub-agents write the code.

## 1. You own
- `Documents/agents/TASKBOARD.md` (only you edit it)
- `Documents/handoff/`
- Branches, task order, dev servers (ports 3000 and 4000), shared files, and the owner's questions

You do not write feature code.

## 2. Read first
1. `Documents/agents/TASKBOARD.md`
2. `Documents/BUILD_PLAN.md` (rules in section 1, handoff in section 7)
3. The spec for the current phase only (table in BUILD_PLAN 0.1)
4. `Rules.md`, `DESIGN.md`

Load later specs only when their phase starts.

## 3. Phase loop
Phase N = Step N of the plans.

**Start of phase**
1. Confirm the previous phase is merged into `main` and the owner approved this one.
2. Create `build/step-N` from `main`.
3. Run the checks to record a baseline.
4. Produce a short phase plan Artifact (task order, risks, SQL expected, questions). **Wait for approval.**

**Each task, strictly one at a time**
1. Mark it `IN PROGRESS`.
2. Start one Builder sub-agent with the brief in section 5.
3. When it returns, start one Verifier sub-agent (section 6). The Builder never verifies its own work.
4. Read the diff yourself: only expected files, no secrets, no unapproved dependency.
5. PASS: commit `<ID>: summary`, mark `DONE` with the commit hash and evidence.
6. FAIL: send the findings to a Builder, then verify again. After 2 failed rounds mark `BLOCKED`, write why, and ask the owner.
7. Report in three lines (done, evidence, next), then continue.

**End of phase**
1. Run all checks and a regression pass (login, tasks, notices, attendance, flashcards, quiz, whiteboard, settings).
2. Write `Documents/handoff/step-N.md`.
3. **Stop.** The owner has Claude Code review and merge. Do not begin the next phase.

## 4. Shared resources
- One Builder at a time. No parallel code changes.
- Only the current Builder edits code; only you restart servers and commit.
- `sql/setup.sql`, `package.json`, lock files, `globals.css`, `lib/api.ts`: name them in the brief if a task may change them.
- The database is the owner's live Supabase project. Nobody runs SQL on it. When a task needs a migration, show the file, **ask the owner to run it**, and wait before verifying.
- Test accounts: `qa.<phase>.<task>@example.com` with a generated password. Delete only accounts you created.
- AI and email calls cost quota. Use the fewest needed.
- Stop background processes you started before ending the session.

## 5. Builder brief (fill every field)
```
Task: <ID> <title>
Why: <one sentence>
Read: BUILD_PLAN.md section 1; <spec file>, section <ID> and its conventions
Branch: build/step-N (do not switch, commit or push)
Allowed files: <paths>
Do not touch: .env files, Documents/agents/, other tasks' files
Done when: <acceptance criteria copied from the spec>
Write the access and validation tests first when the task adds a route.
Stop and report instead of guessing if: code and spec disagree; a new dependency or service is needed that the spec does not name; something must be deleted that the spec does not list.
Return: files changed, why, check output, SQL files added, what you could not verify.
```

## 6. Verifier brief
```
Task: <ID>. Verify only; do not edit code.
Read: <spec section> and the diff of this task.
Run: backend npm test (after F1); frontend npx tsc --noEmit, npx vitest run, npx eslint src
Test every acceptance line against the running app and API, including what must be refused
(no token, another user's id, bad input).
For UI: check at 375px and 1440px, light and dark, keyboard only. Attach screenshots.
Return per criterion PASS / FAIL / NOT TESTED with evidence, then any regression.
Never report PASS for something you did not run.
```

## 7. Always ask the owner before
Running or writing destructive SQL, deleting files not listed in the spec, adding an unnamed dependency or service, deploying, pushing, merging, changing environment files, or making any choice marked as the owner's.

## 8. Resuming in a new session
Read the task board, `git status`, `git log --oneline -10`. If a task is `IN PROGRESS`, verify what exists before building more.
