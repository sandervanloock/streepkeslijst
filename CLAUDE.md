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

## Project status

This repository has no application code yet — only Backlog.md task management (`backlog/`) and this file. There is no package.json, framework, or build tooling committed. Do not assume commands like `npm run build`/`test` exist; check for their presence before using them, and update this file's Commands section once a stack is scaffolded.

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
