---
id: TASK-3
title: Build the main overview (Streepkeslijst lijst) screen from the Claude Design
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 19:58'
updated_date: '2026-09-02 20:52'
labels:
  - ui
  - design
dependencies:
  - TASK-2
  - TASK-1
references:
  - >-
    https://claude.ai/design/p/097faf3b-4460-408e-9cce-6565e1e6e93a?file=Streepkeslijst+App.dc.html
  - design/Streepkeslijst App.dc.html
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first product screen: the live tally list every leider lands on. The approved design is the Claude Design project "Streepkeslijst App.dc.html", imported to design/ in this repo. Build the "lijst" screen from it rather than inventing a new visual direction. The Dutch copy in the design is final - keep it.

Design language (taken from the design file):
- Canvas #121310 with a faint lime radial glow and a 1px scanline texture; rows #161811, cards #1B1D17, paper text #F4F1E6.
- Accents: lime #D8F651 (primary, "IK", euro), amber #F0A32B (BAK), red #E4483A (gomstand), purple #7A4BD1 (beheerder).
- Type: Anton for uppercase display (names, totals, headings), Space Grotesk for body and UI, ui-monospace for the small letterspaced eyebrow labels.

What the screen contains, top to bottom:
1. Header: the "Streepkeslijst" title plus a 44px profile pill (avatar initial, nickname, hamburger) that opens the side menu and carries a red unread-count badge.
2. A LIVE chip and the current period range.
3. Three stat tiles: total streepjes, total bakken (amber), total te innen in euro (lime).
4. A hint line plus two toggle chips: sound on/off and "gomstand" (correction mode).
5. When gomstand is on, a red explainer panel: the same gestures inverted, tap removes one streep, hold removes one BAK, and removals stay visible struck through in the log with the actor name.
6. The person list. Each row: nickname in Anton uppercase, an "IK" badge for the signed-in user, real name, a chalk tally rendering of the streepjes, the numeric total on the right, and an amber BAK total when that person has bakken.
7. A dashed "+ gast toevoegen" action for a one-off guest on this period only, no account.

Interactions:
- Tap a row = +1 streep, with immediate optimistic feedback.
- Press and hold a row for about 620ms, with a progress bar filling along the bottom of the row, opens the BAK sheet: an amber bottom sheet with a -/+ stepper and "Zet op zijn naam".
- Every mutation raises an undo snackbar with an "ONGEDAAN" action.
- Logging for someone else must record who logged it, for whom and when, per the product rules in CLAUDE.md. The design surfaces this on the row and in Meldingen.

Out of scope: the other screens in the design file (Afsluiten, Beheer, Mijn profiel, Betalen, Inningen, Meldingen, the afsluit-wizard and the share sheet). Those get their own tasks. The side menu only has to open far enough to navigate; its destinations can be stubs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The lijst screen matches the design's layout, colours, typography and Dutch copy on a mobile viewport
- [x] #2 Tapping a person's row adds one streep and the row total and header stats update immediately
- [x] #3 Pressing and holding a row for about 620ms shows the hold progress bar and opens the BAK sheet, where a chosen number of bakken is added to that person
- [x] #4 Gomstand inverts both gestures: tap removes one streep, hold removes one BAK
- [x] #5 Every add or remove shows an undo snackbar that reverses the action when used
- [x] #6 Each entry records who logged it, for whom and when, and is readable back
- [x] #7 Adding a guest via '+ gast toevoegen' puts them on the list for the current period only
- [x] #8 Tallies persist to Firestore and the list reflects changes made by other leiders without a manual refresh
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Data model (append-only ledger, no counters)

- meta/period (single doc, seeded on first load if missing): { nr, start, eind|null, open, perBak:24, prijs:1.5, bakPrijs:30 }. Afsluiten/periode-beheer is another task; this doc is the seam.
- users/{uid}: already written on login by auth.ts. Add nick (fallback: first word of displayName) so the Anton row name exists without a profile screen.
- periods/{periodId}/guests/{id}: { nick, naam, mail|null, by, at } - guests live under the period, so they are current-period-only for free (AC7).
- periods/{periodId}/entries/{id}: { personRef:'user:<uid>'|'guest:<id>', kind:'streep'|'bak', delta:+n|-1, by:<uid>, byNick, at:serverTimestamp() }. Every mutation is one entry: tap = +1 streep, BAK sheet = +n bak, gomstand = delta -1. Nothing is ever mutated, so who/for whom/when is the storage format itself (AC6) and removals stay in the log to be rendered struck through later.
- Totals are derived by summing entries client-side. periodId = 'p' + nr.
- ponytail: full-ledger onSnapshot, ~a few hundred docs per period. Add per-person counter docs only when a period actually gets big enough to feel it.

Steps

1. index.html: Anton + Space Grotesk link, body background (#121310 + lime radial glow + scanline repeating-linear-gradient), and the chalkIn/holdfill/sheetUp/panelIn keyframes copied from the design file. Everything else stays inline-styled like the design.
2. src/tally.tsx: port tally(count) and the j() jitter helper verbatim from the design (lines 917-957), krijt style only, drop the blokjes prop. Groups of 5 with the diagonal, cap at 20 + 'en N meer'.
3. src/period.ts: pure aggregation. totals(entries) -> Map<personRef,{streep,bak}>, and euroTotaal(totals, prijs, bakPrijs). This is the money path, so it gets the one test file (src/period.test.ts): grouping, negative deltas, empty ledger, euro rounding to the ',' format.
4. src/data.ts: firestore glue on the existing db. usePeriod(), usePeople() (users + guests snapshots merged), useEntries(periodId) -> onSnapshot (AC8 realtime, no refresh), and the writers addStreep/addBak/removeOne/undo(entryId) = deleteDoc. Optimistic feedback comes free: local write to the same snapshot fires immediately.
5. src/Lijst.tsx: the whole screen, ported section by section from design lines 36-119 - header + profile pill with unread badge (badge count stubbed at 0 until Meldingen exists), LIVE chip + periodebereik, three stat tiles, hint line + geluid/gomstand chips, the red gomstand explainer, the person rows, the dashed '+ gast toevoegen'. Dutch copy verbatim.
6. Gestures on the row: onPointerDown starts a 620ms timer and sets holdId (the 3px holdfill bar animates), onPointerUp before it fires = tap, onPointerLeave/Cancel aborts. Ported from design lines 1281-1295 including the gomstand inversion (hold = -1 BAK, tap = -1 streep). touch-action:none on the row.
7. BAK sheet (design 717-735): amber bottom sheet, -/+ stepper clamped 1-9, 'Zet op zijn naam' writes one bak entry. Guest sheet (583-618): bijnaam required, naam/mail optional, writes to guests.
8. Snackbar (710-714): last write id in state, 4.2s fade / 4.5s clear, ONGEDAAN calls undo. Colour lime for adds, amber for schrappen; texts verbatim from design 1331-1340.
9. Sound: port klik() (design 958-974) into src/Lijst.tsx - WebAudio noise burst + navigator.vibrate. Toggle persisted in localStorage.
10. Side menu (533-580): opens, lists the nav entries, every destination except lijst is a stub screen with its title. Explicitly stubbed per the task's scope note.
11. src/App.tsx: drop the ping shell, render <Lijst /> behind the existing auth gate.
12. firestore.rules: replace the placeholder for these paths - entries create-only with request.resource.data.by == request.auth.uid, no update, delete only of your own entry (that is what undo is), guests create/read for any signed-in user, meta/period read-only from the client. Keeps the audit trail non-forgeable, which is a product rule, not polish.
13. Verify: npm test, npm run build, and npm run dev against the develop database - two browsers open to check a streep from one shows up in the other without a refresh.

Skipped on purpose: the 'blokjes' tally variant (design prop, krijt is the default), the herkomst line (computed in the design but never rendered on the lijst row), unread-badge counting (needs Meldingen), and role badges/permissions beyond the rules above.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the lijst screen per the 13-step plan.

Files:
- index.html: Anton/Space Grotesk fonts, canvas bg (#121310 + lime radial glow + scanline), the 4 keyframes.
- src/tally.tsx: ported tally()/j() verbatim (krijt only, no blokjes prop).
- src/period.ts: pure aggregation totals()/euroTotaal()/euro() - tested in src/period.test.ts (grouping, negative deltas, empty ledger, euro comma formatting).
- src/data.ts: Firestore glue on the existing db - usePeriod (seeds meta/period on first load), usePeople (users + periods/{id}/guests merged), useEntries (onSnapshot), writers addStreep/addBak/removeOne/undo/addGuest.
- src/Lijst.tsx: the whole screen - header+profile pill (unread badge stubbed at 0), LIVE chip+periodebereik, 3 stat tiles, hint+geluid/gomstand chips, gomstand explainer, person rows with chalk tally, hold gesture (620ms, onPointerDown/Up/Leave/Cancel, holdfill bar), BAK sheet, guest sheet, undo snackbar, klik() WebAudio+vibrate gated by a localStorage-persisted sound toggle, side menu with stub screens for every destination except Lijst.
- src/auth.ts: userDoc now also writes nick (first word of displayName) so the Anton row name exists without a profile screen.
- src/App.tsx: dropped the ping shell, renders <Lijst user={user}/> behind the existing auth gate.
- firestore.rules: entries create-only with by==auth.uid, no update, delete only your own entry; guests create/read for signed-in users, no update/delete; meta/period read-only except a one-time create for the first-load seed (deviation from the plan's literal "read-only" - explained in final summary).

npm test: 10/10 pass (3 files). npm run build: tsc -b clean (no any/@ts-ignore), vite build succeeds.

Finalization: sandboxed here has no browser/emulator and network access is blocked (a background `npm run dev` + curl smoke test was denied by the sandbox), so none of the 8 acceptance criteria can be closed with the objective, run-the-behavior evidence the finalization guide requires - all 8 are UI/interaction/realtime criteria (layout on a mobile viewport, tap/hold gestures, undo, guest add, cross-client realtime sync). Only npm test and npm run build were run and both pass; that verifies the money-path aggregation (src/period.test.ts) and type-cleanliness, not the interactive behavior itself.

Leaving all 8 acceptance criteria unchecked and the task status as-is (not moving to a terminal status). Sander needs to do the manual pass: `npm run dev` against the develop database, open on a mobile viewport, and check each AC by hand (incl. two tabs open for AC8's realtime check). See the final summary for the itemized list of what to check per AC.

Reviewed the subagent's implementation: added the missing zero-guard in onSchrap (Lijst.tsx). Without it, gomstand on a person with 0 streepjes/bakken wrote a -1 entry, driving totals and the te-innen euro total negative. The design guards the same way (schrap(), design line ~1006).

Sander manually tested against npm run dev / develop database and confirmed all 8 acceptance criteria pass (layout/copy, tap streep, hold+BAK sheet, gomstand inversion, undo snackbar, entry attribution, guest add, cross-client realtime). Checking off all ACs and finalizing on that confirmation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the lijst screen per the approved 13-step plan: index.html (fonts/bg/keyframes), src/tally.tsx (chalk tally), src/period.ts + src/period.test.ts (pure aggregation, tested), src/data.ts (Firestore glue: usePeriod/usePeople/useEntries + addStreep/addBak/removeOne/undo/addGuest), src/Lijst.tsx (full screen: header/profile pill, LIVE chip, stat tiles, hint+geluid/gomstand chips, gomstand explainer, person rows with hold gesture + BAK sheet, guest sheet, undo snackbar, sound toggle, side-menu stubs), src/auth.ts (nick field), src/App.tsx (renders <Lijst/>), firestore.rules (append-only entries, guest create/read-only, meta/period create-once).

Automated verification: npm test 10/10 pass, npm run build clean (tsc -b strict, no any/@ts-ignore; vite build ok).
Manual verification: Sander ran npm run dev against the develop database and confirmed all 8 acceptance criteria behave as specified, including the cross-client realtime sync (AC8) and gesture/undo behavior (AC2-5) that couldn't be exercised in this sandbox.

Deviation: firestore.rules allows meta/period a one-time create (for the first-load seed in usePeriod) instead of being strictly read-only as the plan's rules bullet says; update/delete stay denied.
<!-- SECTION:FINAL_SUMMARY:END -->
