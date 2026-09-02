# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.50.1 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## Git workflow

Every task is developed on its own feature branch — never commit task work to `main`.

1. Before implementing, branch off up-to-date `main`: `git checkout main && git pull && git checkout -b task-<id>-<short-slug>` (e.g. `task-2.11-ci-cd`).
2. Commit on that branch as you go. Stage only the files belonging to the task; leave unrelated working-tree changes alone. Reference the task id in the commit subject, e.g. `Add CI/CD workflow (TASK-2.11)`.
3. After finalization (acceptance criteria verified, final summary written, task moved to the terminal status), push the branch: `git push -u origin <branch>`.
4. Stop there. Opening the PR, reviewing, and merging to `main` is the user's job — do not open, merge, or squash anything without being asked.

## Stack and commands

React 19 + TypeScript on Vite, Firebase SDK for auth and Firestore, Vitest + Testing Library (happy-dom) for tests. All app code lives flat in `src/`; tests sit next to what they test (`period.ts` / `period.test.ts`).

- `npm run dev` — Vite dev server (builds in dev mode, so it talks to the `develop` Firestore database)
- `npm run build` — `tsc -b && vite build`; this is also the typecheck, there is no separate one
- `npm test` — `vitest run`
- No linter is installed. Don't invent a `npm run lint`.

`src/firebase.ts` is the single place the Firebase config and database selection live: a production build targets the `prod` Firestore database, anything else `develop`, with `VITE_FIRESTORE_DB` overriding both.

CI (`.github/workflows/ci.yml`) runs build + tests on every PR and push to `main`, then deploys to Firebase Hosting — a per-PR preview channel built against `develop`, the live channel against `prod` on `main`.

## Product context

Streepkeslijst is a drink-tracking app for Chiro Elzestraat, modeled after the "bierliste" style of apps (tally drinks consumed during events). Key domain rules to preserve in any implementation:

- **Streep (tally)**: one bar/streep = one consumed drink, added behind a person's name.
- **BAK**: a special unit representing a whole crate of beer, entered as an alternative to individual streepjes.
- **Tracking for others**: any leader can log consumption on behalf of someone else, but this must stay fully transparent/auditable (who logged what, for whom, and when) so the system can't be abused.
- **Drankleider role**: a dedicated role that, after a configured period, calculates per-person totals (using a configured price per streep/BAK) and manages payouts. Drankleiders can also invite new members and organize people into groups.
- **Audience/UX**: mobile-first, fast single-handed tallying, aimed at being fun/engaging for 18–25 year olds — favor low-friction interactions (big tap targets, instant feedback) over forms.

## Platform

- **Hosting/deploy target**: Firebase (Hosting), project id `streepkeslijst`.
- **Backend**: Firestore as the database.
- **Auth**: Google Sign-In (Firebase Auth).
- Firebase web config (apiKey, authDomain, etc.) should live in the app's Firebase init module, not be duplicated elsewhere; the apiKey is a public client identifier, not a secret, but avoid hardcoding project config in multiple places.
