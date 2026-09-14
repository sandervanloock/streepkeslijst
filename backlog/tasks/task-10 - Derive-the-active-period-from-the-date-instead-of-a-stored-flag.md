---
id: TASK-10
title: Derive the active period from the date instead of a stored flag
status: Done
assignee:
  - '@sander.vanloock'
created_date: '2026-09-09 06:55'
updated_date: '2026-09-09 08:38'
labels: []
dependencies:
  - TASK-9
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bug: closing a period with an end date in the future flips the whole app to the next period immediately. src/Afsluiten.tsx puts min={period.start} on the date input but no max, and sluitPeriode (src/data.ts) writes meta/period = the next period in the same instant. The lijst only reads meta/period, so it goes live on a period that has not started yet, today's streepjes land in it, and the closed period's totals are frozen while its last day has not even arrived.

Root cause: which period is active is stored (meta/period, plus an 'open' boolean) instead of derived. The stored copy is what flips early. Fix it at the source rather than clamping the date input.

Target model: a period document carries its range - { nr, start, eind|null, prijs, bakPrijs, perBak } - and the active period is the one whose range contains today, i.e. the largest start <= today. Closing sets eind on the closing period and creates the next one with start = dagNa(eind), in one batch, so ranges are contiguous and non-overlapping by construction; 'exactly one active period on any date' then falls out of the data and needs no separate check. meta/period disappears as a source of truth - it is a second copy of facts that already live on the period doc, and the copy is what causes this bug.

What does not survive: TASK-8's frozen totals on the archive doc. They are written at confirm time, but with a future eind people keep streeping afterwards, so they are stale on arrival, and re-freezing them later is the scheduled job this design exists to avoid. Drop the freeze and derive amounts from that period's own entries at that period's own prices. What the freeze was protecting against - a member deleting an old entry to shrink their bill - is replaced by a rules check that an entry may only be written or deleted while its period is the active one. That costs one get() per streep, which TASK-8's plan explicitly refused as too expensive on the hottest path; at this app's scale (one Chiro group, a few hundred entries per period) that call is being reversed on purpose.

Knock-on: src/Betalen.tsx (TASK-9) currently reads archief.totals and moves to derived amounts. Existing develop and prod data has a meta/period doc and archive docs carrying totals, so a migration is needed.

Supersedes parts of TASK-8 (the freeze, the open flag) and TASK-9 (how Betalen gets its amounts).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Closing a period with an end date in the future leaves the lijst, and every other screen, on the current period; the next period becomes live on the day after the chosen end date and not before
- [x] #2 The active period is derived from today's date rather than read from a stored active/open flag, and on any given date exactly one period is active
- [x] #3 Closing sets eind on the closing period and creates the next period with start = dagNa(eind) in one atomic write, so period ranges stay contiguous and never overlap
- [x] #4 Strepen and schrappen only work on the active period: Firestore rules deny creating or deleting an entry under a period whose range does not contain today, covered by firestore.rules.test.ts
- [x] #5 Every amount shown is computed from that period's own entries at that period's own prijs and bakPrijs, with no frozen totals field involved
- [x] #6 Betalen only offers a period for payment once its end date has passed; a period that has been closed with a future end date shows no payable amount yet
- [ ] #7 The existing develop and prod data (a meta/period doc, archive docs carrying totals, entries already written) keeps working after the change, with the migration written down and executed
- [x] #8 Tests cover the date-based active-period selection at its boundaries: the start day, the end day, and the day after the end day
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **One collection, one source of truth.** Every period becomes a `periods/{pid}` doc, the running one included — `meta/period` is deleted, not kept in sync. `usePeriodes()` in src/data.ts replaces both `usePeriod()` and TASK-9's `useArchief()`: one `onSnapshot(collection(db, "periods"))` sorted by `nr`, which is the same single listen the app already pays for today. The first-load seed moves with it: if the collection is empty, write `periods/p1` instead of `meta/period`.

2. **Pure selection in src/period.ts.** `actievePeriode(periodes, vandaag)` — the period whose range contains `vandaag`, i.e. `start <= vandaag && (eind == null || vandaag <= eind)`. Because close writes `start(n+1) = dagNa(eind(n))` in one batch (step 4), the ranges are contiguous and the last one is open-ended, so exactly one period matches on any date and AC2 is a property of the data rather than a check anyone has to run. This is the whole fix: a future `eind` no longer moves `vandaag` out of the current period's range. Tested at the three boundaries AC8 names — the start day, the end day, and the day after.

   Delete `Period.open` while here. Its only reader is src/Lijst.tsx's `!period.open` guard on strepen and the AFGESLOTEN hint, and with a date-derived active period the screen is showing the active period by definition. Fewer states, no flag to get out of sync — the same class of bug as this one.

3. **Timestamps next to the ISO dates.** The rules in step 5 must compare a period range against the request time, and rules cannot zero-pad `request.time.month()` into a `YYYY-MM-DD` string to compare against ours, nor cheaply parse ours back into ints. So each period doc carries `startAt` and `eindAt` as Firestore timestamps beside the human `start`/`eind` strings, and rules do a plain timestamp compare. ponytail: two representations of one fact, written together in the same batch and never separately — collapse them only if a later change makes the ISO strings redundant on the client.

4. **`sluitPeriode` (src/data.ts) stops freezing anything.** It becomes one `writeBatch`: set `eind`/`eindAt` (plus the next period's prices are not its business) on `periods/{pid}` of the closing period, and create `periods/{pid+1}` with `{ nr: nr+1, start: dagNa(eind), startAt, eind: null, eindAt: null, perBak, prijs, bakPrijs }`. One commit, so the ranges can never be left half-written (AC3). The `totals` field, `closedBy`/`closedAt` aside, is gone — with a future `eind` it would be computed before the streepjes that belong to that period even exist, and re-computing it after the fact is exactly the scheduled job this design removes. src/Afsluiten.tsx needs no change to its wizard: a future last day is now correct rather than a bug, and its checklist already says the next period starts on `dagNa(eind)`.

5. **Rules replace the freeze.** What the frozen totals defended against is a member deleting an old entry to shrink a settled bill, so put that where it belongs — `match /periods/{periodId}/entries/{entryId}` gains a `binnenPeriode()` check on create and delete: `get(/databases/$(database)/documents/periods/$(periodId)).data` and require `request.time >= startAt && (eindAt == null || request.time < eindAt + duration.value(1, "d"))`. Update stays `false`, and creating an entry attributed to someone else stays denied. This is one `get()` per streep, which TASK-8's plan refused as too expensive on the app's hottest path; at one Chiro group and a few hundred entries a period that call is being reversed deliberately, and a stale amount is a money bug where an extra document read is a rounding error. Note the `periods/{pid}` doc rule needs no change: `create, update: if isDrankleider()` already covers writing `eind`.

6. **Amounts are derived (src/Betalen.tsx, src/period.ts).** `Archief.totals` disappears, so `bedrag()` gets its input from the ledger instead: for each payable period, `query(collection(db, "periods", pid, "entries"), where("personRef", "==", myRef))` — Firestore's automatic single-field index covers this, no composite index and no rules change, and it reads only my own entries rather than the whole period. Run it through the existing `totals()` and `bedrag()` at that period's own `prijs`/`bakPrijs` (AC5). ponytail: one small query per payable period shown; if the history list ever grows long enough to notice, cache a totals map back onto the period doc — safe to do *then*, because by then the ledger is locked by step 5.

7. **Betalen only pays for finished periods (AC6).** A period is payable when `eind != null && eind < vandaag`. That is a stricter filter than "has an eind": a period closed with a future last day is still being streeped on, so it shows no amount and no copy fields — its bill does not exist yet. The newest payable period is the card, the rest are EERDERE PERIODES, and when there is no payable period at all the screen shows the existing Niets openstaand card. `useBetaling`/`meldBetaling`/`herroepBetaling` and the `betalingen/{personRef}` rules from TASK-9 are unchanged.

8. **Migration (AC7).** develop and prod hold a `meta/period` doc for the running period, `periods/p{n}` archives carrying `totals`, and entries already written. There are only a couple of period docs in each, so this is done by hand in the Firebase console rather than by adding firebase-admin and a script for a one-off: for the running period write `periods/p{nr}` from the `meta/period` fields, add `startAt`/`eindAt` to every period doc, then delete `meta/period`. The stale `totals` and `open` fields on the old docs can stay — nothing reads them after this task, and leaving them is one less destructive step against real data. Write the exact per-document values into the task notes before touching anything, run it on develop first, and deploy the rules (`firebase deploy --only firestore:rules`) in the same sitting, since step 5 makes entry writes depend on the new `startAt`/`eindAt` fields being present.

9. **Tests.**
   - `src/period.test.ts`: `actievePeriode` on the start day, the end day, the day after (the regression this task exists for), and across a closed-with-future-eind pair where the answer must stay the current period.
   - `src/data.test.ts`: `sluitPeriode` writes exactly two docs in one batch, with `start(n+1) == dagNa(eind(n))` and no `totals` field.
   - `src/Betalen.test.tsx`: a period closed with a future end date offers nothing to pay; the same period offers its amount once the date has passed; amounts come out at that period's own prices.
   - `src/firestore.rules.test.ts`: a member may create an entry under the active period, may not create one under a period whose `eindAt` has passed, and may not delete their own entry from it either.
   - `src/Lijst.test.tsx`/`src/Afsluiten.test.tsx`: adjust for the removed `open` flag and the `usePeriodes` shape.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (TASK-10). Files changed: src/period.ts (afrekening removed, actievePeriode added — pure, tested at start/end/day-after boundaries), src/data.ts (Period type gains startAt/eindAt Timestamps and drops open; usePeriod+useArchief replaced by usePeriodes reading the whole periods collection; sluitPeriode rewritten as a 2-doc writeBatch with no totals/entries param; useOwnEntries added for Betalen's derived amounts), src/Betalen.tsx (reads periodes prop + useOwnEntries instead of useArchief/archief.totals; AC6 payable filter eind!=null && eind<vandaag), src/Afsluiten.tsx (sluitPeriode call updated, no wizard/copy changes per plan), src/Lijst.tsx (usePeriod->usePeriodes+actievePeriode, removed period.open guards on streep/schrap, removed AFGESLOTEN hint and chip opacity), firestore.rules (meta/period removed, periods/{pid} is the single source, entries create/delete gated by new binnenPeriode() get()-based check). Tests updated across period.test.ts, data.test.ts, Betalen.test.tsx, Afsluiten.test.tsx, Profiel.test.tsx, Lijst.test.tsx, firestore.rules.test.ts. npm run build and npm test pass; npm run test:rules passes 18/18 with the sandbox disabled (emulator ports blocked otherwise, same workaround as TASK-8/9).

MIGRATION (AC7) — written down, NOT executed. Run by hand in the Firebase console on develop first, then prod, since this agent has no credentials to develop/prod and must not mutate live data.

Per database (develop, then prod), in this order:

1. Read meta/period. Note its fields: nr, start, eind, prijs, bakPrijs, perBak (open is dropped, not migrated).
2. If a periods/p{nr} doc already exists for that nr (it shouldn't, since meta/period is the running period, not yet archived), stop and reconcile by hand — don't overwrite.
3. Create/merge periods/p{nr} (nr = meta/period's nr) with:
   - nr, start, eind, prijs, bakPrijs, perBak  (copied verbatim from meta/period)
   - startAt: Timestamp for start at 00:00:00 UTC of the `start` date (new Date(start + 'T00:00:00Z'))
   - eindAt: null if eind is null, otherwise the Timestamp for eind at 00:00:00 UTC (same recipe)
   Leave any existing 'open' field on this doc alone if present — nothing reads it after this task, removing it is not required.
4. For every OTHER existing periods/p{n} doc (the already-closed archives with a `totals` field), add startAt and eindAt the same way, computed from that doc's own start/eind. Leave `totals` and `closedBy`/`closedAt` in place — nothing reads `totals` after this task, deleting it is not required and is one less destructive step against real data.
5. Delete meta/period only after step 3 has been verified (read it back, confirm periods/p{nr} matches).
6. Deploy the updated firestore.rules in the same sitting: `firebase deploy --only firestore:rules` — entries create/delete now depend on startAt/eindAt existing on every period doc that has live entries, so rules and data must land together.

Example (illustrative field mapping, not real values — read the actual meta/period doc first):
  meta/period = { nr: 4, start: '2026-08-01', eind: null, prijs: 1.5, bakPrijs: 30, perBak: 24 }
  -> periods/p4 = { nr: 4, start: '2026-08-01', eind: null, startAt: Timestamp('2026-08-01T00:00:00Z'), eindAt: null, prijs: 1.5, bakPrijs: 30, perBak: 24 }
  -> delete meta/period once periods/p4 is confirmed correct

AC7 left UNCHECKED: the migration is written down but not executed against develop/prod (out of scope per the task brief — no live-data writes from this agent), and the rules deploy is still pending. Both are manual steps for the user.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The active period is now derived from today's date (src/period.ts's actievePeriode) instead of a stored meta/period doc with an 'open' flag — closing a period with a future end date no longer flips the lijst to the next period early. periods/{pid} is the single source of truth for every period, running one included (src/data.ts's usePeriodes replaces usePeriod+useArchief); sluitPeriode is one writeBatch that sets eind/eindAt on the closing period and creates period nr+1 with start = dagNa(eind), no totals frozen. Betalen derives amounts from each period's own entries (useOwnEntries, a where-filtered query) at that period's own prijs/bakPrijs, and only offers a period once its eind has passed. firestore.rules replaces the freeze with a binnenPeriode() check gating entries create/delete to the period whose startAt/eindAt range contains request.time.

Verified: npm run build (typecheck) passes; npm test passes 108/108 across period.test.ts (actievePeriode at the start/end/day-after boundaries and across a closed-with-future-eind pair), data.test.ts (usePeriodes, its seed, useOwnEntries, sluitPeriode's 2-doc no-totals batch), Betalen.test.tsx (AC1/AC5/AC6), Afsluiten.test.tsx, Lijst.test.tsx, Profiel.test.tsx; npm run test:rules passes 18/18 against the real emulator (sandbox disabled for that one command — port binding is blocked otherwise), including new binnenPeriode coverage (create/delete allowed in the active period, denied once eindAt+1day has passed).

AC7 left unchecked on purpose: the develop/prod migration (meta/period -> periods/{pid} with startAt/eindAt, per-doc field mapping) is written into the task's implementation notes for the user to run by hand in the Firebase console, and the firestore.rules deploy is still pending — this agent has no credentials to develop/prod and was scoped not to touch live data.

Built on task-9-betalen (commit d8e99d2), not main — TASK-9 is not yet merged, so this PR stacks on TASK-9's.
<!-- SECTION:FINAL_SUMMARY:END -->
