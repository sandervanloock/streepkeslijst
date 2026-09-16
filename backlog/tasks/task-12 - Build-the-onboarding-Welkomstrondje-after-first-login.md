---
id: TASK-12
title: Build the onboarding 'Welkomstrondje' after first login
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:27'
updated_date: '2026-09-16 20:50'
labels: []
dependencies: []
documentation:
  - design/Onboarding.dc.html
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A leader who signs in for the first time lands straight on the lijst with an empty profile: no nick, no idea that tapping their own row is the whole app, and no clue what happens at the end of a period. The design adds a five-step welcome round between Login and Lijst — design/Onboarding.dc.html, a new file in the Claude Design project next to the one TASK-3..TASK-11 were built from.

The five steps: (1) Welkom — what the lijst is, with prijs per streepje and the number of leiders on the list; (2) Jouw naam — Chironaam + echte naam, with a live preview of the row you will become; (3) Streepje zetten — a fake row you can actually tap: tik = +1, 620 ms vasthouden opens the bak sheet, plus the gomstand (corrigeren) and geluid toggles, and the gesture legend; (4) Afrekenen — three cards explaining period loopt / beheerder sluit af / een bericht in de groep, plus an example bill and mededeling; (5) Klaar. Every step but the last has 'Overslaan' top-right, which opens a confirm sheet ('Rondje overslaan?' -> 'Toch verder kijken' / 'Naar de lijst'). Progress is the chalk-strokes bar plus a 'STAP n VAN 5' counter, and 'Terug' sits under the primary button from step 2 on.

Watch the design's numbering: in renderVals the sN flags are crossed — s3 is stap 2 (the name screen) and s2 is stap 3 (the tap demo). Read it by the labels array ['Welkom','Jouw naam','Streepje zetten','Afrekenen','Klaar'], not by the block order in the markup.

Only step 2 writes anything: the nick and naam go through the existing saveProfile in src/data.ts (the same write src/Profiel.tsx already does), and 'Verder' on step 2 is blocked while the nick is empty. Steps 3 and 4 are pure demo — the tally, the bak sheet and the example bill are local state, and nothing lands in Firestore.

The demo row has to feel like the real one, and the real one is split: src/tally.tsx renders the chalk strokes, but the gestures live in src/Lijst.tsx — HOLD_MS (line 35), useKlik (lines 45-77) and the onHoldDown/Up/Cancel handlers on the row. The 620 ms and the tik/bak sounds should be shared rather than re-typed, so the two cannot drift apart.

Which leaves the two things the design implies but does not spell out: where 'seen' lives, and how you get back in.

'Seen' is part of the profile. It goes on the same users/{uid} doc that saveProfile already writes (next to nick, name, mail), so the one doc the app reads for 'who am I' also answers 'has this person had the round'. Finishing the round sets it and so does Overslaan — skipping is a decision, not a postponement. Whatever reads it gates the round before the lijst renders. No rules change is expected: firestore.rules already lets you update your own users/{uid} with no field whitelist.

Getting back in is a link on the Mijn profiel screen (src/Profiel.tsx), under the profile card, deliberately subtle — a small text link in the same muted style as the existing hint copy there, not a button and not a nav item. No new menu entry; the round keeps its own hash route alongside the slugs in src/route.ts so a refresh stays put.

That moves the design's own copy, so the Dutch in the round has to follow: step 5's 'Dit rondje opnieuw bekijken kan altijd via Menu -> Hoe werkt het' and the skip toast's 'terug te vinden bij Menu' both have to point at Mijn profiel instead, which is also where step 2's 'Later te wijzigen bij Profiel' already sends people.

Out of scope: the design's nick suggestions (the suggesties list in renderVals is computed but never rendered), and any change to the profile card in Profiel.tsx beyond adding the link.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A leader signing in for the first time gets the welcome round before the lijst; on every later sign-in they go straight to the lijst
- [x] #2 The round has the five steps in the design order (Welkom, Jouw naam, Streepje zetten, Afrekenen, Klaar) with the chalk progress bar, the 'STAP n VAN 5' counter, and 'Terug' available from step 2 on
- [x] #3 Step 2 saves the Chironaam and echte naam to the signed-in user's profile, shows the live row preview, and refuses to continue while the Chironaam is empty
- [x] #4 Step 3's demo row responds to tik (+1), vasthouden (bak sheet), the gomstand and the geluid toggle exactly like the real row, and writes nothing to Firestore
- [x] #5 Step 4 shows the three period-explanation cards and an example amount and mededeling derived from what the user tapped in step 3
- [x] #6 'Overslaan' on steps 1-4 opens the confirm sheet; 'Naar de lijst' leaves the round and does not show it again unprompted, 'Toch verder kijken' returns to the step
- [x] #7 Finishing the round and skipping it both mark it as seen on the user's own users/{uid} profile doc, alongside nick and naam
- [x] #8 Mijn profiel has a subtle text link under the profile card that restarts the round, and the round has its own hash route so a refresh stays on it
- [x] #9 The round's Dutch copy points people back to Mijn profiel, not to a menu entry, on step 5 and in the skip toast
- [x] #10 Tests cover the first-login gate, step navigation incl. Terug, the empty-nick block and the profile save, the demo gestures, both Overslaan outcomes, and the restart link on Mijn profiel
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. data.ts: extend useProfile to also return `rondje: boolean` (the users/{uid} field, default false) and add `markRondje(uid)` — setDoc merge { rondje: true }. No firestore.rules change: rules line 39 allows update on your own users/{uid} and whitelists no fields.

2. tally.tsx: move HOLD_MS (Lijst.tsx:35) and useKlik (Lijst.tsx:45-77) out of Lijst.tsx into tally.tsx and import them back. Pure move, no behaviour change — it just puts the hold duration and the tik/bak sounds next to the strokes they belong to so the demo row and the real row cannot drift.

3. src/Rondje.tsx, new screen ported from design/Onboarding.dc.html, Dutch copy verbatim except the two lines the link move forces (step 5 and the skip toast now say Mijn profiel). Props { user, onKlaar }. One local state blob: stap, nick, naam, nickFout, demo, bak, gom, geluid, bakOpen, bakAantal, overslaan, toast.
   - steps driven by the design's labels array, not by the crossed sN flags; chalk progress bar, 'STAP n VAN 5', Overslaan on stap < 5, Terug on stap > 1.
   - stap 2 'Dit ben ik': empty nick -> nickFout and stay; otherwise saveProfile(user.uid, nick, naam, existing mail) + toast, then on.
   - stap 3 demo row: tally() for the strokes, useKlik for the sounds, a local pointer-down/up handler on HOLD_MS for tik vs bak — same numbers as the real row, but every count is component state and no write leaves the screen. Bak sheet and the gom/geluid toggles ported as-is.
   - stap 4: the three cards, plus the example bill from the demo counts at the design's own €0,70 and 24-per-bak (an illustration, deliberately not the live period's prices) and the mededeling through period.ts mededeling().
   - finishing on stap 5 and 'Naar de lijst' in the skip sheet both call markRondje(uid) and then onKlaar().

4. route.ts: add `rondje: 'Hoe werkt het'` to schermen, so the round has a hash and survives a refresh like every other screen.

5. Lijst.tsx: gate before the shell renders — if the profile has loaded and rondje is false, or the current scherm is 'Hoe werkt het', render <Rondje onKlaar={...}> instead of the lijst. Deliberately not added to alleNav, so it gets no menu entry and the route guard keeps ignoring it.

6. Profiel.tsx: one subtle text link under the profile card — `<a href="#/rondje">` in the existing muted hint style. A plain anchor on purpose: useScherm already listens on hashchange, so no callback needs threading down into this screen.

7. Tests: src/Rondje.test.tsx (step navigation incl. Terug, the empty-nick block and the saveProfile call, the tik/vasthouden/gom demo gestures, both Overslaan outcomes, and that markRondje fires on finish and on skip), plus the first-login gate in Lijst.test.tsx and the restart link in Profiel.test.tsx. Verify with npm test && npm run build (build is the typecheck).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per recorded plan, validated against current code first (no drift). data.ts: useProfile now returns rondje (default false); added markRondje(uid) writer, both merge:true, no rules change needed (users/{uid} update already has no field whitelist). tally.tsx: moved HOLD_MS + useKlik out of Lijst.tsx (pure move) so the real row and the Rondje demo row share the exact hold duration and sounds. New src/Rondje.tsx: five-step round, ported from design/Onboarding.dc.html, labels-array driven (not the crossed sN flags). Lijst.tsx gates on profile.rondje === false OR scherm === 'Hoe werkt het', rendered before the period/pid null-check since Rondje fetches its own period/people. route.ts: added rondje -> 'Hoe werkt het' slug, deliberately excluded from Lijst's alleNav (no menu entry). Profiel.tsx: added a subtle <a href="#/rondje"> text link under the profile card, muted-hint style, relying on the existing hashchange listener in useScherm (no callback threaded down). Skip-toast and step 5 copy changed to point at Mijn profiel per task's decision. Tests: new Rondje.test.tsx (7 tests: navigation+Terug, empty-nick block + saveProfile, demo tik/vasthouden/gomstand with zero Firestore writes, stap4 cards+bedrag, both Overslaan outcomes, markRondje on both finish and skip, stap5/skip copy pointing at Mijn profiel); extended Lijst.test.tsx (first-login gate x2, #/rondje reopen), Profiel.test.tsx (restart link), data.test.ts (rondje default + markRondje), route.test.ts (rondje slug). npm test: 133/133 green. npm run build: passes (tsc -b + vite build).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the five-step Welkomstrondje (src/Rondje.tsx), ported from design/Onboarding.dc.html, using the labels array (not the crossed sN flags). It gates the lijst in Lijst.tsx on the signed-in user's own users/{uid}.rondje flag (data.ts's useProfile now returns it, default false) or on scherm === 'Hoe werkt het' (route.ts's new rondje slug, deliberately excluded from Lijst's alleNav so it has no menu entry). Step 2 saves nick/naam via the existing saveProfile and blocks on an empty Chironaam; steps 3-4 are local-state-only demo (tik/vasthouden/gomstand/geluid share HOLD_MS and useKlik, moved out of Lijst.tsx into tally.tsx so the real row and the demo row cannot drift). Finishing and 'Naar de lijst' in the skip sheet both call the new markRondje(uid) writer (merge:true, no firestore.rules change needed — update on your own users/{uid} already has no field whitelist). Mijn profiel (Profiel.tsx) got a subtle text link under the profile card, and step 5 plus the skip toast now point at Mijn profiel instead of the design's Menu → Hoe werkt het. Verified with npm test (133/133, incl. new Rondje.test.tsx and extensions to Lijst.test.tsx, Profiel.test.tsx, data.test.ts, route.test.ts) and npm run build (tsc -b + vite build, clean). All 10 ACs checked off objective test evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
