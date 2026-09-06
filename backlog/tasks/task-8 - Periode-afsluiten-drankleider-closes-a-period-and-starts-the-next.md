---
id: TASK-8
title: 'Periode afsluiten: drankleider closes a period and starts the next'
status: Done
assignee: []
created_date: '2026-09-06 17:59'
updated_date: '2026-09-06 18:14'
labels: []
dependencies: []
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The nav item "Periode afsluiten" (src/Lijst.tsx:277, drankleider-only) is still a stub, and meta/period is seeded once and then read-only for everybody (firestore.rules says as much: "Afsluiten / periode-beheer (another task) is the only thing allowed to change it after that, and will need its own rule then"). This task builds that screen and the write behind it, from design/"Streepkeslijst App.dc.html": the betalingenOpen block (lines 145-172) plus the three-step wizard (lines 620-710) and sluitPeriodeAf (line 1123).

The screen shows the running period (LIVE badge, range, and the three stats: streepjes, leiders, te verdelen) with one red "Afsluiten" button. That button opens a three-step wizard: (1) pick the last day of the period, (2) set the price per streepje and per BAK that will apply from the NEXT period on, (3) a checklist confirming what is about to happen. Confirming freezes the current period totals so they stop moving, and immediately opens period nr+1 with the new prices, so there is always an open lijst to streep on (design line 1122).

Out of scope: Inningen, Betalen and the payment/message flows that consume the frozen totals. Afsluiten sends nothing (design line 650) - it only closes and reopens.

Context the implementer needs: the current period lives in meta/period (src/data.ts:16-50, incl. nr/start/eind/open/perBak/prijs/bakPrijs), the ledger under periods/{periodId}/entries with periodId = "p" + nr, and per-person totals come from the pure totals()/euroTotaal() helpers in src/period.ts. Prices are real money, so the frozen totals must be computed at the prices the closed period ran at, not the new ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A drankleider (or beheerder) reaching "Periode afsluiten" sees the running period with the LIVE badge, its date range and the three live stats; a lid cannot open the screen even by typing the route
- [x] #2 Step 1 picks the last day of the period with a native date input, defaulting sensibly and not allowing a day before the period start
- [x] #3 Step 2 sets the price per streepje and per BAK for the next period, starting from the current prices, and cannot go below zero
- [x] #4 Step 3 shows the confirmation checklist and states the action is irreversible before the confirm button commits anything
- [x] #5 Confirming closes the period: its totals and the prices it ran at are persisted so later changes to price or entries cannot move them
- [x] #6 Confirming also opens period nr+1 starting the day after the chosen end day, with the new prices, so streepjes can be added again straight away
- [x] #7 Closing is atomic: an interrupted confirm never leaves the app with two open periods or with none
- [x] #8 Firestore rules let only a drankleider or beheerder close a period and write the new one; a lid is denied, covered by firestore.rules.test.ts
- [x] #9 Tests cover the wizard steps and their validation, the close write, and the pure date/period helpers in period.test.ts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Close the menu gap first (AC1).** `nav` in src/Lijst.tsx:271 already tags `Inningen` and `Periode afsluiten` with `rol: 'drankleider'`, but only `Beheer` is actually filtered out (line 279) and only `Beheer` is re-checked on the hand-typed route (line 284). Today a lid sees the menu item and `#/afsluiten` opens for anyone. Generalise both to the tag that is already there: filter `nav` on `!t.rol || magRol(myRole, t.rol)` and gate `open` the same way, with `magRol` a pure helper in src/period.ts (`beheerder` satisfies `drankleider`, per this task's AC1/AC8). That fixes Inningen's gap in the same line — the lazy fix is the shared one, not a second `=== 'Beheer'` special case.

2. **Archive shape.** Closing writes a `periods/{periodId}` parent doc — the collection exists but the doc never has: `{ nr, start, eind, prijs, bakPrijs, perBak, totals: { <personRef>: { streep, bak } }, closedBy, closedAt }`. Freezing the per-person totals onto that doc, rather than recomputing from `periods/{pid}/entries` later, is what makes AC5 hold: rules let a member delete their own entry, so an untouched ledger is not something we can promise. The alternative — locking a closed period's entries in rules — costs a `get()` on the parent period doc for every single streep, on the app's hottest path. Take the one write, not the per-streep read, and leave a `ponytail:` comment naming the ceiling (the archive is denormalised; the ledger under it stays as the audit trail and can be re-summed by hand if they ever disagree).

3. **Pure core in src/period.ts** (the no-Firestore, always-tested module):
   - `dagNa(iso)` — design's `dagNa` (line 1064): "12 juli" → "13 juli", so periods close seamlessly onto each other. `new Date(iso)` + `setUTCDate(+1)` + `toISOString().slice(0,10)`; UTC on purpose, a local-midnight Date shifts the day in a negative-offset zone.
   - `magRol(mijn, nodig)` for step 1.
   - `afrekening(period, entries, eind, nieuwePrijs, nieuweBakPrijs)` returning `{ archief, volgende }` — the two docs the batch writes. It reuses the existing `totals(entries)` and freezes `period.prijs` / `period.bakPrijs` (the prices it *ran* at), never the new ones; the new prices go on `volgende` only. `volgende = { nr: nr+1, start: dagNa(eind), eind: null, open: true, perBak, prijs: nieuwePrijs, bakPrijs: nieuweBakPrijs }`. Guests need no filtering (design line 1131 does): guests live under `periods/{pid}/guests`, so a fresh periodId starts empty for free.

4. **`sluitPeriode()` in src/data.ts.** One `writeBatch` (the precedent is `claimInvite` in auth.ts): `set(doc(db,'periods',periodId(nr)), archief, {merge:true})` — merge because the subcollections' parent may already be a phantom doc — plus `set(doc(db,'meta','period'), volgende)`. One commit, so AC7's "never two open periods or none" is Firestore's problem, not ours. The function stays a thin wrapper over the pure `afrekening` above.

5. **src/Afsluiten.tsx**, branched from the `scherm` chain in src/Lijst.tsx:331 exactly as `Beheer` is, with the same belt-and-braces role guard inside the component (`return null` for a lid). Ported from the design's `betalingenOpen` block (lines 145-172) plus the wizard (620-710), Dutch copy verbatim; the heading and the DRANKLEIDER badge already come from the shared header row in Lijst.tsx, so the component starts at the subtitle. Contents:
   - **Overview:** LIVE badge + `instPeriodeBereik`, the three-stat strip (streepjes incl. `bak * perBak`, leiders, te verdelen via the existing `euroTotaal`), and the red Afsluiten button.
   - **Wizard**, one `stap` state 1|2|3 with the design's three progress bars. Step 1: native `<input type="date">` (rung 4 — the design uses one too), `min={period.start}`, defaulting to today clamped to `>= start`; Next disabled otherwise, so AC2's validation is the platform's. Step 2: the two −/+ steppers over `prijs` and `bakPrijs`, seeded from the current period, clamped at 0, with the design's live "per streepje in een bak" comparison box. Step 3: the checklist and the irreversible-warning line, then confirm.
   - Confirm calls `sluitPeriode`, then `onToast('Periode N afgesloten · iedereen ziet zijn bedrag onder Betalen')` and returns to the lijst. The design lands on Inningen (line 1144); that screen is still a stub, so the lijst it is — and the lijst is already showing the new empty period by then, which is the reassurance that matters.

6. **Rules.** Add `isDrankleider()` next to `isBeheerder()` (role in `['drankleider','beheerder']`). Then `meta/period`: `allow update: if isDrankleider()` replacing today's flat `if false` and the comment that pointed at this task. Add `match /periods/{periodId}` document rules (only the subcollections are covered now): `allow read: if isMember(); allow create, update: if isDrankleider(); allow delete: if false`. Rules cannot verify the frozen totals actually match the ledger, so say so in a `ponytail:` comment: a drankleider with devtools can write a wrong archive, same trust level as the role itself.

7. **Tests.**
   - `src/period.test.ts`: `dagNa` across a month and a year boundary, `magRol`, and `afrekening` — totals frozen at the old prices, next period starting the day after, prices carried onto the next one only.
   - `src/Afsluiten.test.tsx` in the `Beheer.test.tsx` style: the overview stats; step 1 rejects a date before the period start; the price steppers do not go below zero; step 3 confirm calls `sluitPeriode` with the chosen values and toasts.
   - `src/Lijst.test.tsx`: the menu item and the `#/afsluiten` route are absent for a lid, present for a drankleider (extends the existing Beheer gating test).
   - `src/firestore.rules.test.ts`: a drankleider may update `meta/period` and create `periods/p1`; a lid may do neither.

8. **Verify:** `npm run build` (this is the typecheck), `npm test`, `npm run test:rules`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch stacked on up-to-date main (bf4a5c4 already carries TASK-7's invites/isMember/isBeheerder work; main==task-7-invites, verified with git diff --stat). Implemented per the recorded plan with one small deviation: the wizard is rendered as an inline in-screen swap (overview <-> 3-step wizard) inside Afsluiten.tsx rather than a full-screen absolute overlay like the design's wzOpen block -- ponytail: Periode afsluiten is a screen, not a modal, in this port, so the overlay chrome (fixed inset:0, its own close button) was unneeded weight; same 3 steps, same copy, same validation. Also skipped: the design's nav sub-lines (line 1697-1705, e.g. 'nog geen einddatum gekozen' under Periode afsluiten in the menu) -- that's a pre-existing gap across every nav item, not just this task's screen, so adding it only here would be a one-off special case; flagging as a candidate follow-up task, not silently taking it. Ran test:rules with the sandbox disabled (npm run test:rules) since the emulator can't bind its ports otherwise -- 14/14 rules tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the Periode afsluiten screen (src/Afsluiten.tsx) and the write behind it (sluitPeriode in src/data.ts, afrekening/dagNa/magRol pure helpers in src/period.ts). Lijst.tsx's nav/route guard is generalised to magRol so every drankleider-tagged destination (Inningen, Periode afsluiten), not just Beheer, is actually gated -- both in the menu and on a hand-typed route. Confirming the wizard writes one Firestore batch: periods/{pid} gets the closed period's totals frozen at the prices it ran at, meta/period gets period nr+1 with the new prices and start = dagNa(chosen end day). firestore.rules gained isDrankleider() and real rules for periods/{periodId} and meta/period's update. Verified: npm run build (typecheck) clean; npm test 89/89 passing across 11 files including new src/Afsluiten.test.tsx (7 tests: role gate, stats, date-min clamp, price floor, checklist-before-write, confirm writes+toasts, back/stop); period.test.ts covers dagNa across month/year boundaries, magRol's role hierarchy, and afrekening freezing old prices onto the archive while only the next period gets the new ones; Lijst.test.tsx covers the menu/route gate for the newly-fixed drankleider items. npm run test:rules (sandbox disabled, emulator needs real ports) 14/14 passing, including a new AC8 test proving a drankleider can write periods/{id} and update meta/period while a lid can do neither. AC7 (atomic close) is verified by construction -- both writes are one writeBatch.commit(), so Firestore itself guarantees no partial state, not something a unit test can additionally prove. Deviated from the plan on presentation only: the wizard is an inline in-screen swap, not a full-screen absolute overlay -- ponytail, since this is a screen not a modal in this port. Skipped as out of scope: the design's nav sub-lines (e.g. 'nog geen einddatum gekozen') are missing repo-wide, not just for this screen -- flagged as a candidate follow-up, not taken silently.
<!-- SECTION:FINAL_SUMMARY:END -->
