---
id: TASK-3
title: Build the main overview (Streepkeslijst lijst) screen from the Claude Design
status: To Do
assignee: []
created_date: '2026-09-02 19:58'
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
- [ ] #1 The lijst screen matches the design's layout, colours, typography and Dutch copy on a mobile viewport
- [ ] #2 Tapping a person's row adds one streep and the row total and header stats update immediately
- [ ] #3 Pressing and holding a row for about 620ms shows the hold progress bar and opens the BAK sheet, where a chosen number of bakken is added to that person
- [ ] #4 Gomstand inverts both gestures: tap removes one streep, hold removes one BAK
- [ ] #5 Every add or remove shows an undo snackbar that reverses the action when used
- [ ] #6 Each entry records who logged it, for whom and when, and is readable back
- [ ] #7 Adding a guest via '+ gast toevoegen' puts them on the list for the current period only
- [ ] #8 Tallies persist to Firestore and the list reflects changes made by other leiders without a manual refresh
<!-- AC:END -->
