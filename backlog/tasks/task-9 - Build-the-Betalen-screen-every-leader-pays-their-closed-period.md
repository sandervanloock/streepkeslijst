---
id: TASK-9
title: 'Build the ''Betalen'' screen: every leader pays their closed period'
status: Done
assignee:
  - '@sander.vanloock'
created_date: '2026-09-08 07:12'
updated_date: '2026-09-08 18:17'
labels: []
dependencies:
  - TASK-8
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The nav item "Betalen" (src/Lijst.tsx) is still a stub: after TASK-8 a period gets closed and frozen into periods/{periodId}, but nobody can see or settle what they owe. This task builds the Betalen screen from design/"Streepkeslijst App.dc.html" (markup lines 309-392, logic lines 1546-1592), plus the account config it depends on.

Betalen is per person and read-mostly: it shows the leader's own amount for the most recent closed period, three copy-to-clipboard fields (bedrag, rekeningnummer + begunstigde, mededeling) so they can paste into their own bank app, an 'Ik heb overgeschreven' button that flips their status to 'gemeld' (with 'toch nog niet betaald' to undo), and a list of earlier periods with their status. When nothing is open it shows the 'Niets openstaand' card instead. There is no bank integration and no automatic reconciliation - 'gemeld' is a claim, not a payment.

IBAN and begunstigde exist nowhere in the app yet (design reads them from s.iban / s.begunstigde) so they are in scope here: add them as drankleider-editable fields on the Beheer screen (src/Beheer.tsx), stored alongside the other group config, and read them on Betalen. Without them the copy fields have nothing to copy.

Context the implementer needs: the frozen archive per closed period (nr, start, eind, prijs, bakPrijs, perBak, totals per person) is written by sluitPeriode in src/data.ts; the pure helpers euro(), euroTotaal(), totals() and mededeling() already live in src/period.ts (mededeling is already previewed on Profiel). Amounts must come from the frozen archive at the prices that period ran at - never recomputed at current prices. Copying uses navigator.clipboard with the design's 'gekopieerd' feedback state on the tapped field.

Out of scope: Inningen (the drankleider's reconcile-and-tick-off screen, design 393+) and the mail/group message flows - those consume the same payment status and get their own task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Any leider opening 'Betalen' sees their own amount for the most recent closed period, the period range and their streepjes count, computed from the frozen archive at the prices that period ran at
- [x] #2 The three fields bedrag, rekeningnummer (with begunstigde) and mededeling each copy to the clipboard on tap and show the 'gekopieerd' state on that field only
- [x] #3 'Ik heb overgeschreven' sets the person's status to 'gemeld', the card switches to the Doorgegeven state, and 'toch nog niet betaald' puts it back to open
- [x] #4 A leider with nothing outstanding sees the 'Niets openstaand' card instead of the payment card
- [x] #5 Earlier closed periods are listed with their range, streepjes, amount and status
- [x] #6 Firestore rules let a member set only their own payment status and only to 'gemeld' or open, never to 'betaald' (that is the drankleider's call in Inningen); covered by firestore.rules.test.ts
- [x] #7 Betalen never writes to a closed period's frozen totals or prices
- [x] #8 Tests cover the amount and status rendering, the copy actions, the melden/herroepen flow, and the Beheer account fields
- [x] #9 A beheerder can set the rekeningnummer and begunstigde on Beheer; every member (incl. drankleiders and lidden) reads them on Betalen but cannot change them
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Where the payment status lives.** The design keeps it in one flat `s.p6[id]` map, but ours has to be writable by the person themselves while the frozen archive stays drankleider-only, so it cannot go on `periods/{pid}` itself. Add `periods/{pid}/betalingen/{uid}` — doc id the uid, exactly so the rule can be `request.auth.uid == uid` with no `get()`. The doc IS the status: `{ status: "gemeld" | "betaald", at }`, no doc = open, and "toch nog niet betaald" is `deleteDoc` of your own doc. That keeps Betalen at one write and one delete, and leaves Inningen (next task) the same collection to set `betaald` on. Guests have no account and therefore no doc — the drankleider ticks them off in Inningen, out of scope here.

2. **Reading the closed periods.** Nothing reads the archive yet. `useArchief()` in src/data.ts: one `onSnapshot(collection(db, "periods"))`, sorted by `nr` descending. That collection contains exactly the closed periods — TASK-8's `sluitPeriode` is what creates the parent doc, the running period only has phantom `entries`/`guests` parents underneath it — so no query, no filter, no `where` and no index. One doc per period, a handful a year; a collection listen is cheaper than N `getDoc`s by id and gives the history list for free. The newest one is the payment card, the rest are the EERDERE PERIODES list.

3. **Pure core in src/period.ts** (the no-Firestore, always-tested module): `bedrag({streep, bak}, prijs, bakPrijs)` — one persons amount, the per-person twin of the existing `euroTotaal`, which only sums the whole map. Everything else Betalen needs is already there: `euro`, `kort`, and `mededeling(nick, period)`, whose `{nr, start, eind}` shape the archive doc already matches (its already previewed on Profiel). The amount is read from `archief.totals[myRef]` at `archief.prijs`/`archief.bakPrijs` — the prices that period *ran* at, frozen by TASK-8 — never recomputed from `meta/period`.

4. **IBAN + begunstigde on meta/group** (src/data.ts), not a new doc: `Group` grows `iban` and `begunstigde`, `saveGroupName` generalises to a `saveGroup(patch)` merge write, and `useGroup` keeps its existing default-fallback behaviour. `meta/group` already reads `isMember()` and updates `isBeheerder()`, so this costs zero rules changes — the reason to put it there rather than on `meta/period` (drankleider-writable) or a new `meta/rekening`. Beheer.tsx is beheerder-only already; add the two fields as a REKENING block under DE GROEP, same bordered-input + `onBlur`-saves pattern as the group name. Note the scope change from the original AC: the account is beheerder-set, not drankleider-set, because Beheer is the only screen a drankleider cannot open and giving them the field would mean a second home for it.

5. **src/Betalen.tsx**, branched from the `scherm` chain in src/Lijst.tsx (`open === "Betalen"`, next to Beheer/Afsluiten), props `{ user, people, group, period, onToast }`. Every leider may open it, so unlike Beheer/Afsluiten there is no role guard and no nav gating — `Betalen` already carries no `rol` in `alleNav`. Ported from the design's `betalenOpen` block (lines 309-392) plus its state (1546-1592), Dutch copy verbatim; the heading comes from the shared header row in Lijst.tsx, so the component starts at the subtitle. Contents:
   - **NOG OVER TE SCHRIJVEN card** for the newest archive when my status is not `betaald`: the TE BETALEN / DOORGEGEVEN chip and its red/amber border, the period range, the big amount, and `N streepjes · €x,xx per streepje`.
   - **Three copy fields** (BEDRAG, REKENINGNUMMER · BEGUNSTIGDE, MEDEDELING) over `navigator.clipboard.writeText` — same rung as `shareInvite`'s fallback in data.ts. One `gekopieerd` state holding the key of the last-tapped field, so only that row flips to the lime "gekopieerd" state; the copied bedrag is the raw `12.50`, not `€12,50`, because it is going into a bank app.
   - **"Ik heb overgeschreven"** → status `gemeld` + toast; the Doorgegeven panel then shows with "toch nog niet betaald" undoing it. If a drankleider already set `betaald`, neither button shows — the card is replaced by the lime **Niets openstaand** card.
   - **EERDERE PERIODES**: the remaining archives, each with range, streepjes, amount and BETAALD/OPEN status, from the same `useArchief` list.

6. **Rules.** One new block inside `match /periods/{periodId}`: `match /betalingen/{uid}` — `allow read: if isMember()` (Inningen and the lijst need everyones status, and the amounts are not secret inside the group); `allow create, update: if (request.auth.uid == uid && request.resource.data.status == "gemeld") || isDrankleider()`; `allow delete: if (request.auth.uid == uid && resource.data.status != "betaald") || isDrankleider()`. That is AC7 literally: a member can claim, and retract their claim, but only a drankleider writes `betaald` or overrides one. Nothing here can touch the archive docs frozen totals or prices (AC8) — they sit on the parent, whose `create, update: if isDrankleider()` is unchanged.

7. **Tests.**
   - `src/period.test.ts`: `bedrag` over streepjes + bakken, and that it uses the archives frozen prices rather than the live ones.
   - `src/Betalen.test.tsx` in the `Afsluiten.test.tsx` style (mock `./data`, assert on rendered Dutch copy): the amount and streepjes for the newest closed period; each copy field writing the right raw value to a stubbed `navigator.clipboard` and only that row showing "gekopieerd"; melden → `gemeld` and the Doorgegeven panel, herroepen → back to open; a `betaald` status showing Niets openstaand; the earlier-periods list.
   - `src/Beheer.test.tsx`: the two account fields save on blur.
   - `src/firestore.rules.test.ts`: a lid may write their own `gemeld` and delete it, may not write `betaald`, may not write someone elses doc, and may not delete a doc a drankleider set to `betaald`; a drankleider may do all of it.

8. **Amendment to steps 1, 6 and 7 — guests.** A guest has no account (`addGuest`, src/data.ts), so they can never own a doc keyed by uid, yet the frozen archive keys its totals by `personRef` and a guest owes money like anyone else. Keying the status by uid would make a guests payment unrecordable by anybody, the drankleider in Inningen included. So the doc id is the **personRef**, not the uid: `periods/{pid}/betalingen/{personRef}` — `user:u1`, `guest:g1`. The self-claim rule stays a plain string compare with no `get()` and no `split()`: `betalingId == "user:" + request.auth.uid`. Guest docs match no members own-doc test, so they fall through to the `isDrankleider()` arm and only a drankleider can set or clear them — which is correct, since a guest cannot claim anything themselves.

   Consequences: step 5s lookup becomes `betalingen[myRef]` (Betalen already has `myRef`, the same value Lijst.tsx uses); step 6s three rules read `betalingId == "user:" + request.auth.uid` in place of `request.auth.uid == uid`; step 7 adds a rules test that a lid cannot write a `guest:` status at all, and a drankleider can.

   Guest-side UX is out of scope here and belongs to Inningen: the drankleider ticks a guest off against the bank statement, and the guests own mail address (already captured by `addGuest`) is where the afrekening message goes. Betalen itself shows nothing for guests — there is nobody signed in to show it to.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan (steps 1-8 incl. the personRef-keyed betalingen amendment). data.ts: Group gains iban/begunstigde with a default-fallback merge (like useGroup's existing naam fallback) so a pre-TASK-9 doc doesn't blank the fields; saveGroupName generalised to saveGroup(patch) — the one call site in Beheer.tsx updated, and Lijst.test.tsx's shared data mock updated to match (it renders Beheer/Betalen inline). Added useArchief (periods collection, sorted nr desc, no query/index), useBetaling/meldBetaling/herroepBetaling keyed by periods/{pid}/betalingen/{personRef}. period.ts gained bedrag() (euroTotaal's per-person twin). Betalen.tsx ported from design lines 309-392/1546-1592; the REKENING block on Beheer has no matching markup in the design (only state at 1447-1451), so it's modeled on the existing group-name field instead of ported verbatim. firestore.rules: new periods/{pid}/betalingen/{betalingId} match using the plain string compare betalingId == 'user:' + request.auth.uid — no get(), no split() — so a guest doc never matches a member's own-doc arm and falls through to isDrankleider() only.

Verification: npm run build passes (tsc -b + vite build). npm test: 103/103 passing across 12 files, incl. new src/Betalen.test.tsx (7), src/period.test.ts additions (bedrag), src/data.test.ts additions (useArchief/useBetaling/meldBetaling/herroepBetaling/saveGroup), src/Beheer.test.tsx addition (AC9 rekening fields), src/Lijst.test.tsx updated (Betalen is no longer the 'Komt nog.' stub). npm run test:rules needed the sandbox disabled to bind the emulator's ports (matches the harness's known lesson) — with it disabled, 16/16 rules tests pass, incl. two new TASK-9 tests for AC6 (a lid melds/herroeps only their own doc, never 'betaald', never a guest's or another member's doc; a drankleider may do all of it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the Betalen screen (src/Betalen.tsx) plus its account config on Beheer. Every leider now sees, for the most recent closed period (src/data.ts's useArchief over periods/, no query/index needed), their own amount computed from the frozen archive at the prices it ran at (period.ts's new bedrag()), with three copy-to-clipboard fields (bedrag/rekeningnummer+begunstigde/mededeling), an 'Ik heb overgeschreven'/'toch nog niet betaald' flow, a 'Niets openstaand' fallback when nothing is outstanding (incl. when no period was ever closed), and an EERDERE PERIODES history list. Payment status lives at periods/{pid}/betalingen/{personRef} — keyed by personRef per the plan's step-8 amendment, not uid, so a guest's payment stays recordable by a drankleider in the (out-of-scope) Inningen. firestore.rules gained a matching betalingen block: a member's self-claim is a plain string compare (betalingId == 'user:' + request.auth.uid, no get()/split()), can only ever set 'gemeld' or delete their own non-betaald doc, never write 'betaald' themselves; a drankleider can do all of it, including a guest's doc. Beheer gained a REKENING block (iban/begunstigde) under DE GROEP, beheerder-writable via the generalised saveGroup(patch), read-only everywhere else. Verified: npm run build (tsc -b + vite build) passes; npm test 103/103 across 12 files including new/updated coverage for every AC; npm run test:rules 16/16 (sandbox disabled to bind the emulator's ports), including two new AC6 rules tests. All 9 ACs checked against this evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
