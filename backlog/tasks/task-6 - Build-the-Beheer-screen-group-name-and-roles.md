---
id: TASK-6
title: 'Build the ''Beheer'' screen: group name and roles'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-03 16:31'
updated_date: '2026-09-03 17:08'
labels: []
dependencies: []
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the 'Beheer' stub in src/Lijst.tsx with the real screen from design/'Streepkeslijst App.dc.html' (the beheerOpen block, ~line 175), minus the invitation part which is TASK-7. Introduces the role model the whole app is missing today: there is currently no role field anywhere in src/, so nothing can distinguish lid / drankleider / beheerder. Roles: a drankleider closes the period and keeps the lijst straight, a beheerder invites people and assigns roles, a lid is everyone else. The 'DE GROEP' section lets a beheerder rename the group (design default 'Chiro Elzestraat'), which is shown in the menu subtitle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A role field (lid | drankleider | beheerder) lives on users/{uid} and defaults to lid for a new user
- [x] #2 The 'Beheer' menu item and screen are only reachable for a beheerder; a lid or drankleider does not see the menu item
- [x] #3 Screen shows the BEHEERDER badge, group-name input, and a ROLLEN list of all members with the three-way lid/drankleider/beheerder selector per person
- [x] #4 Picking a role writes it immediately, shows the toast from the design, and the avatar colour updates to match the new role
- [x] #5 The role counter above the list shows the live 'N drankleiders · N beheerders' totals
- [x] #6 Group name is persisted (a single meta doc, alongside meta/period) and empty name shows the red border from the design
- [x] #7 Firestore rules let only a beheerder write another user's role or the group name; a lid attempting either is denied, covered by firestore.rules.test.ts
- [x] #8 A beheerder cannot demote themselves to the last non-beheerder, so the group can never be left without one
- [x] #9 Tests cover role gating of the screen, changing a role, and the group-name save
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Role model.** Add `role: 'lid' | 'drankleider' | 'beheerder'` to the `users/{uid}` doc. Set it in `src/auth.ts` only on first login (the same missing-doc guard TASK-5 introduces for `nick`), so a role assigned in Beheer survives every later sign-in. Treat a missing `role` as `lid` when reading, so the existing users already in both databases need no migration.
2. **Expose the role.** Widen `Person` in `src/data.ts:55` with `role` and map it in the `users` branch of `usePeople` (`d.data().role ?? 'lid'`); guests get `'lid'`. Guests are not group members, so filter them out of the ROLLEN list. Derive `myRole` in `src/Lijst.tsx` from the existing `people.find(p => p.personRef === myRef)` lookup already used for `myNick` (line 103) - no extra read.
3. **First beheerder (bootstrap).** Nobody can grant a role until somebody has it. Do not build a bootstrap flow: set `role: 'beheerder'` by hand once in the Firebase console on the owner's `users/{uid}` doc, in both the `develop` and `prod` databases, and record that step in the implementation notes so it is not lost.
4. **Group doc.** Store the group as `meta/group` -> `{ naam: 'Chiro Elzestraat' }`, alongside the existing `meta/period`. Add `useGroup()` to `src/data.ts` mirroring `usePeriod` (src/data.ts:36): seed-once with `getDoc`/`setDoc`, then `onSnapshot`. Add `saveGroupName(naam)`.
5. **Menu gating.** `nav` in `src/Lijst.tsx:209` is a flat string array. Filter `'Beheer'` out unless `myRole === 'beheerder'`, matching the design's `enkelAdmin` filter (design line 1705). While in there, give the Beheer entry the design's subtitle `<groepsnaam> · N uitnodigingen wachtend` - the invite count comes with TASK-7, so render just the group name for now.
6. **Beheer screen.** Add `src/Beheer.tsx` exporting `Beheer({ user, people, group, onTerug })` and branch to it from the `scherm` stub at `src/Lijst.tsx:211`, exactly as TASK-5 does for the profile. Port the `beheerOpen` block of design/"Streepkeslijst App.dc.html" (lines 175-265) minus the two invite sections: the purple `BEHEERDER` badge, heading and subtitle, the `DE GROEP` name input (red border when empty, per `groepRand`), the `ROLLEN` header with its live counter, the purple explainer box, and one row per member with a coloured avatar and the three-way `Lid / Drankleider / Beheerder` selector. Colours from the design: beheerder `#7A4BD1` on paper text, drankleider `#D8F651` on `#121310`, lid `rgba(244,241,230,.1)`. Re-render on the role change is free - `usePeople` is a live listener. Guard the component itself on `myRole === 'beheerder'` too, so a hand-typed route cannot reach it.
7. **Role writes.** Add `setRole(uid, role)` to `src/data.ts` (`setDoc` with `{ merge: true }`). Tapping the already-active option is a no-op (design: `if (rol === o.key) return`). On success show the design toast `<nick> is nu <rol>` through the existing `zegSnack`, hoisting it or passing it down as a prop.
8. **Last-beheerder guard.** Before writing, refuse a change that would leave zero beheerders (in practice: yourself, when you are the only one). Put the check in a pure helper in `src/period.ts` - the tested no-Firestore module - so it gets a unit test rather than only a UI test, and show the refusal as the inline red error the design already styles.
9. **Rules.** Add an `isBeheerder()` helper to `firestore.rules` reading `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'beheerder'`. Then: `users/{uid}` stays self-writable (TASK-5) *or* writable by a beheerder; `meta/group` readable by any signed-in user, writable only by a beheerder. Rules cannot express the last-beheerder invariant (it needs a collection-wide count), so leave that as a client-side guard and say so in a `ponytail:` comment naming the ceiling: worst case a beheerder with the devtools open demotes the last one and the role has to be restored from the console, the same path as the bootstrap in step 3.
10. **Tests.** `src/Beheer.test.tsx` in the `Lijst.test.tsx` style: the screen renders the member rows with the right active option; picking a role calls `setRole` and shows the toast; the counter reflects the roles; saving the group name persists it; an empty name shows the red state. In `Lijst.test.tsx`, add that the Beheer menu item is absent for a `lid` and present for a `beheerder`. In `period.test.ts`, cover the last-beheerder helper. In `firestore.rules.test.ts`, add: a beheerder may write another user's `role` and `meta/group`; a lid may write neither.
11. **Verify.** `npm run build`, `npm test`, `npm run test:rules`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branched off task-5-mijn-profiel, not main (user chose the stacked option): TASK-6 builds on TASK-5s missing-doc guard in auth.ts, the users/{uid} self-write rule and the scherm branch in Lijst.tsx, all of which are still unmerged. Rebase with `git rebase --onto main task-5-mijn-profiel task-6-beheer` once TASK-5 lands, and retarget the PR.

MANUAL STEP, not done and not doable from code: the first beheerder must be set by hand. Nobody can grant a role until somebody has one, so open the Firebase console and set `role: "beheerder"` on the owners users/{uid} doc in BOTH the develop and prod databases. Until that is done the Beheer menu item is invisible to everyone.

Snack/toast: `Snack.id` is now optional and the ONGEDAAN link only renders when there is an id. A Beheer toast has no entry behind it, so the old unconditional link would have called undo() with undefined.

Group name saves on blur rather than behind a separate button: the design has no save button in the DE GROEP block, only the input.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Beheer screen (src/Beheer.tsx) and the role model behind it. users/{uid}.role is lid | drankleider | beheerder, seeded to lid on first login in auth.ts and read as absent-means-lid in usePeople, so the accounts already in develop/prod need no migration. The group lives in meta/group, seeded and read by useGroup exactly like usePeriod. Beheer is gated on the beheerder role twice: the menu item is filtered out in Lijst.tsx and the component returns null, so a hand-typed route cannot reach it either. firestore.rules gained an isBeheerder() helper; only a beheerder may write someone elses role or rename the group.

Two deliberate ceilings, both commented: the "never zero beheerders" invariant is a client-side guard in Beheer.tsx via the pure magRolWijzigen() helper in period.ts, because rules cannot count a collection; and the first beheerder is seeded by hand in the Firebase console rather than through a bootstrap flow.

Verified: npm run build clean (this is the typecheck), npm test 53/53 across 9 files, npm run test:rules 10/10 against the real Firestore emulator. Each AC has a named test - AC2 gating in Lijst.test.tsx, AC3-AC6 and AC8 in Beheer.test.tsx (11 tests incl. avatar colour and the counter), AC8 also unit-tested in period.test.ts, AC7 in firestore.rules.test.ts, AC1 via data.test.ts/setRole plus the seeding in auth.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
