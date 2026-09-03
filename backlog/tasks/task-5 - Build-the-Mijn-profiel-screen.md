---
id: TASK-5
title: Build the 'Mijn profiel' screen
status: Done
assignee:
  - '@claude'
created_date: '2026-09-03 16:31'
updated_date: '2026-09-03 16:57'
labels: []
dependencies: []
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the 'Mijn profiel' stub in src/Lijst.tsx with the real screen from design/'Streepkeslijst App.dc.html' (the profielOpen block, ~line 267). Everyone gets this screen: it is where a member sets the nick that identifies their row on the lijst, their full name, and the mail address their afrekening is sent to. Today nick is auto-derived in userDoc() in src/auth.ts (displayName split on space) and can never be changed, so two people called Wouter are indistinguishable on the lijst.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Menu item 'Mijn profiel' opens a real screen instead of the 'Komt nog.' stub
- [x] #2 Screen shows BIJNAAM, VOLLEDIGE NAAM and MAILADRES VOOR JE AFREKENING inputs prefilled from the signed-in user's users/{uid} doc
- [x] #3 Saving writes nick, naam and email back to users/{uid} and the new nick immediately shows on that person's row on the lijst
- [x] #4 Empty nick is rejected with an inline error and nothing is saved
- [x] #5 A nick already taken by another person is rejected with an inline error naming the clash
- [x] #6 The live 'Mededeling: ...' preview under the nick input updates as you type
- [x] #7 userDoc() no longer overwrites a nick the user has set themselves on every login
- [x] #8 Firestore rules allow a user to write only their own users/{uid} profile fields; tests in firestore.rules.test.ts cover this
- [x] #9 Tests cover the save, the empty-nick error and the duplicate-nick error
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Profile screen as its own component.** Add `src/Profiel.tsx` exporting `Profiel({ user, people, onTerug })`, following the `Login.tsx` shape (own file, inline styles, Dutch copy verbatim from the design). Port the `profielOpen` block of design/"Streepkeslijst App.dc.html" (lines 267-307): the avatar/menu header row, the ANTON `Mijn profiel` heading and subtitle, then one card with the BIJNAAM input (Anton, uppercase), VOLLEDIGE NAAM input, the mededeling hint, the MAILADRES VOOR JE AFREKENING block behind a top border, and the lime `Bewaren` button.
2. **Wire it into the existing stub seam.** `src/Lijst.tsx:211` currently renders one "Komt nog." placeholder for every `scherm`. Branch `scherm === 'Mijn profiel'` to `<Profiel>` and leave the stub for the remaining destinations. Pass down the `people` list already loaded by `usePeople` so the duplicate-nick check needs no extra read, and `setScherm(undefined)` as `onTerug`.
3. **Read the current values.** `usePeople` (src/data.ts:58) already maps `users/{uid}` to `{ nick, naam }`, so prefill nick and naam from `people.find(p => p.personRef === 'user:' + user.uid)`. Email is not in `Person`; rather than widen that type for one screen, add a small `useProfile(uid)` hook in `src/data.ts` that `onSnapshot`s the single `users/{uid}` doc and returns `{ nick, naam, email }`. Seed the email input from `user.email` when the doc has none.
4. **Save.** Add `saveProfile(uid, { nick, naam, email })` to `src/data.ts` next to `addGuest`, using `setDoc(..., { merge: true })` so it never clobbers `photoURL`/`lastLogin`. Validate before writing, mirroring `bewaarNieuw` (src/Lijst.tsx:185): empty trimmed nick -> `Geef een bijnaam.`; a trimmed nick that case-insensitively equals another person's nick (skip your own row, include guests) -> `<nick> is al bezet.`. Render the error in the red inline style from the design and set the input border to `#E4483A`. On success show the existing snack/toast and return to the lijst. Because `usePeople` is a live `onSnapshot`, the new nick appears on the row and in the menu `INGELOGD ALS` block with no extra work.
5. **Stop `userDoc` from overwriting the nick.** `src/auth.ts:12-20` recomputes `nick: displayName.split(' ')[0]` and merges it on every `onAuthStateChanged`, so a saved nick would be undone at the next login. Split the payload: keep the always-merged fields (`name`, `email`, `photoURL`, `lastLogin`) in `userDoc`, and write the derived nick only when the doc does not exist yet (a `getDoc` check, or `setDoc` of the nick with `{ merge: true }` guarded by a missing-doc read in `useAuth`). Update the stale comment that points at TASK-3.
6. **Mededeling preview.** The design derives it from `mededeling(nick)` (design line 888): `STREEPJES P<nr> <dd/mm start>-<dd/mm eind> <NICK>`. Put `mededeling(nick, period)` and its `kort(iso)` date helper in `src/period.ts`, the existing pure/tested module next to `euro`, and render `Mededeling: ...` live under the nick input from the typed value falling back to the current nick.
7. **Rules.** `firestore.rules:7-9` currently lets any signed-in user write any `users/{uid}` doc. Tighten to `allow read: if request.auth != null;` plus `allow write: if request.auth.uid == uid;`, which is what this screen needs and closes the hole. Note in the rule comment that beheerder-driven writes to someone else's doc arrive with TASK-6.
8. **Tests.** `src/Profiel.test.tsx` following the `Lijst.test.tsx` pattern (mock `./data`, real component): a successful save writes nick/naam/email and returns to the lijst; an empty nick shows `Geef een bijnaam.` and writes nothing; a nick colliding with another person shows the taken error and writes nothing; the mededeling preview follows what you type. Add a `period.test.ts` case for `mededeling`, and a `firestore.rules.test.ts` case proving u1 can write `users/u1` and cannot write `users/u2`.
9. **Verify.** `npm run build` (this is also the typecheck), `npm test`, and `npm run test:rules` against the emulator.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
npm run test:rules could not run inside the sandbox (EPERM binding emulator ports); ran once with the sandbox disabled and all 8 firestore.rules.test.ts cases pass, including the new AC8 users/{uid} write-scoping test.

Follow-up fix after review: the payout address is stored as `mail`, not `email`. `userDoc()` refreshes `email` from the Google account on every login, so a hand-picked afrekening address written to `email` was silently reverted at the next sign-in — the same trap AC7 removed for the nick, one field over. Guests already used `mail` for their afrekening address (addGuest), so the roster is consistent now. Covered by a regression test in data.test.ts asserting saveProfile never writes `email`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added src/Profiel.tsx (BIJNAAM/VOLLEDIGE NAAM/MAILADRES card, Dutch copy verbatim from design lines 267-307) and wired it into Lijst.tsx's scherm==='Mijn profiel' branch, replacing the stub. data.ts gained useProfile(uid) and saveProfile(uid, nick, naam, email); auth.ts's userDoc() no longer includes nick, and useAuth only seeds a derived nick on first login (getDoc check) so a saved nick survives future logins. firestore.rules now scopes users/{uid} writes to request.auth.uid == uid. mededeling()/kort() moved to period.ts per house style. Verified: npm run build (typecheck) clean; npm test 36/36 passing incl. new Profiel.test.tsx (save, empty-nick, duplicate-nick, live mededeling preview), Lijst.test.tsx AC1 (menu opens the real screen, not 'Komt nog.'), auth.test.ts (userDoc has no nick key), data.test.ts (useProfile/saveProfile); npm run test:rules 8/8 passing when run with the sandbox disabled (blocked inside the sandbox by EPERM on emulator ports), including the new users/{uid} write-scoping case.
<!-- SECTION:FINAL_SUMMARY:END -->
