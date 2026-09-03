---
name: implement-backlog-task
description: Implement one Backlog.md task in this repo end to end — branch, plan of record, slice-by-slice implementation, verification, finalization. Stops uncommitted for the user to manually validate; does not commit or push. Use when the user says "implement TASK-N", "do task N", or "pick up TASK-N". Not for creating or planning tasks, and not for work that has no Backlog task.
model: sonnet
---

# Implement a Backlog task

One task, one branch, one focused diff. The Backlog task is the plan of record;
the branch is the work; `main` is the user's to merge.

## 0. Orient

```bash
backlog instructions overview
backlog task view TASK-N --plain
backlog instructions task-execution
```

Read the task's description, acceptance criteria, dependencies and its
**Implementation Plan** if it already has one. A recorded plan was written
against the codebase and is the starting point — verify it still matches the
code before following it, and replace it with `--plan` if the code has moved on.

Check dependencies are actually `Done` before starting. If a dependency is open,
stop and say so.

**Known noise:** every `backlog` command in this repo prints a long
`Failed to refresh remote refs: ...` blob followed by a git fetch error. It is a
sandboxed-network failure, not a real one — the command still succeeds. Look for
the `Created task` / `Updated task` line at the bottom and ignore the blob.

## 1. Branch first

Never commit task work to `main` (`CLAUDE.md` git workflow):

```bash
git checkout main && git pull && git checkout -b task-<id>-<short-slug>
```

If `git pull` cannot reach the remote, carry on from local `main` and mention it
in the final report.

## 2. Claim the task and record the plan

```bash
backlog task edit TASK-N -s "In Progress" -a @<you>
backlog task edit TASK-N --plan "1. ..."   # only if there is no plan, or it is stale
```

A material product, architecture or workflow decision inside the plan gets
raised with the user **before** implementing, not after. Routine plans do not
block.

## 3. Implement in slices

Work the plan one slice at a time: implement → run the relevant check →
`backlog task edit TASK-N --append-notes "..."`. Notes are for what a reviewer
or a future agent could not read off the diff: a decision taken, a surprise
found, a manual step performed.

House style, non-negotiable (see `CLAUDE.md` and the existing files):

- **Read the neighbours before writing.** `src/` is flat; `Lijst.tsx`,
  `Login.tsx` and `data.ts` set the conventions for components, hooks and
  writers. Match their comment density, Dutch copy, and inline-style approach.
- Dutch UI copy is taken **verbatim** from `design/Streepkeslijst App.dc.html`.
  Do not paraphrase, translate or improve it.
- Pure logic belongs in `src/period.ts` (no Firestore, always tested) rather
  than inside a component.
- Firestore reads are `onSnapshot` hooks in `src/data.ts`; writers are small
  exported functions in the same file. Do not scatter Firestore calls into
  components.
- Firebase config lives only in `src/firebase.ts`.
- No new dependency for what a few lines can do. No abstraction with one caller.
- A deliberate shortcut with a known ceiling gets a `ponytail:` comment naming
  the ceiling and the upgrade path.

Do not commit during this step. Leave changes in the working tree — staged is
fine, committed is not — until manual validation (step 5a) has happened.

## 4. Verify

```bash
npm run build      # tsc -b && vite build — this IS the typecheck, there is no separate one
npm test           # vitest run
npm run test:rules # only when firestore.rules changed; needs the emulator
```

There is no linter. Do not invent `npm run lint`.

Every acceptance criterion needs objective evidence — a passing test, or
observed behaviour you can describe. If an AC cannot be verified without
something you do not have (a Blaze plan, real mail delivery, a device), say so
plainly rather than checking it.

## 5. Finalize

```bash
backlog instructions task-finalization
```

Follow it: verify each AC against evidence, `--check-ac` the ones that hold,
write the `--final-summary`, move to the terminal status.

Automated evidence (build, unit tests, rules tests) proves the code does what
it claims in isolation. It does not prove the feature works — today's TASK-7
run had 77 green tests and a real `permission-denied` in the browser twice
over, from things no unit test touches: `firestore.rules` not deployed, then a
silently-broken `firebase-tools` flag. Say so plainly rather than treating
green CI as done.

### 5a. Hand off for manual validation — do not commit yet

Stop here with the work **uncommitted**. Tell the user exactly what to run or
click to see the behaviour for themselves (a page to open, a button to press,
a command to run against the real `develop` backend) and wait for them to
confirm it actually works. Automated checks passing is not that confirmation.

If validation surfaces a bug, fix it in place and ask for validation again —
same branch, still uncommitted. Do not commit a fix speculatively because the
tests pass.

## 6. Commit — only after manual validation, then stop

Once the user has confirmed the behaviour works, commit what belongs to the
task. Stage only the files belonging to the task; leave unrelated
working-tree changes alone. Reference the task id in every commit subject,
e.g. `Add the profile screen (TASK-5)`.

```bash
git commit -m "..."
```

**Do not push, and do not open a PR.** Committing and handing back is the end
of this agent's job — pushing the branch, opening the PR, reviewing and
merging are the user's to do when they're ready.

## Scope discipline

Work found outside the acceptance criteria is not yours to take. Finish
everything inside the ACs, then report the extra as a candidate follow-up task
and let the user decide. Never silently widen the task.

## Report back

Short: branch name, what changed (files), which ACs are checked and on what
evidence, which are not and why, and anything the user must do by hand (a
console seed, a config toggle, a decision left open). If the work is still
uncommitted pending manual validation, say that explicitly and state what you
need the user to check.

## Lessons from earlier runs

These cost real time on TASK-5 and TASK-6. Read them before you start.

- **Grep the siblings of every field and function you touch.** TASK-5 fixed
  `nick` being clobbered on every login, then wrote the payout address into
  `email` — the field right next to it, clobbered by the same code path. Fixing
  the symptom the AC names and reproducing it one field over is the failure mode
  to avoid. Before you finish a slice, grep every reader and writer of the field
  you changed.
- **A required prop that gates rendering will hide your whole screen.** TASK-6
  gated the Beheer screen on `group` being loaded, so a denied read — which is
  exactly what an undeployed rules change looks like — silently showed the old
  stub. Ask what the screen should do when the data never arrives, and prefer a
  fallback over `undefined`.
- **`firestore.rules` is not deployed by the build.** Changing the file does
  nothing to the running `develop` database. Say so in your report and give the
  user `firebase deploy --only firestore:rules`, noting that `firebase.json`
  points it at both `prod` and `develop`.
- **The design carries more than the block you are porting.** Nav sub lines and
  role badges (design lines 556-562, 1697-1705) were missing for two tasks
  because each port only looked at its own `sc-if` block. When you touch a
  screen, diff it against the design as a whole.
- **`location.hash` is the router** (`src/route.ts`). Reset it in `beforeEach`
  or state leaks between tests; happy-dom does not fire `hashchange`
  synchronously. There is no back arrow anywhere — every screen carries the
  menu chip, so navigation is always through the menu.
- **Colours in tests.** happy-dom keeps the inline hex (`#7A4BD1`); it does not
  normalise to `rgb()`. Nicks render uppercase via CSS, so the DOM text is still
  `Sander`, not `SANDER`.
- **The sandbox blocks the emulator and git push.** `npm run test:rules` cannot
  bind its ports and `git push` cannot reach the remote. Both work with the
  sandbox disabled for that one command. Retry that way, and say in your report
  that you did. (This agent no longer pushes at all — see step 6 — but the
  emulator point still applies to `npm run test:rules`.)
- **Green tests aren't the same as working.** TASK-7 passed build + 77 unit
  tests + 13 rules-emulator tests, then failed twice in the real browser: once
  because `firestore.rules` genuinely wasn't deployed, and again — after a
  deploy that reported success — because `firebase-tools@15.5.1` silently
  no-ops `--only firestore:rules` against this repo's array-form multi-database
  `firebase.json` (it parses `rules` as a database name, matches none, deploys
  nothing, prints "Deploy complete!" anyway; `--only firestore` is the working
  form). Neither failure was visible to any test in this repo. This is exactly
  why manual validation gates the commit now, not just CI.
