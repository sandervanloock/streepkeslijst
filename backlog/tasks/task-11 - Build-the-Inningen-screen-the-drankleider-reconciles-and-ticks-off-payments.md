---
id: TASK-11
title: 'Build the ''Inningen'' screen: the drankleider reconciles and ticks off payments'
status: Done
assignee:
  - '@sander.vanloock'
created_date: '2026-09-10 18:41'
updated_date: '2026-09-14 17:44'
labels: []
dependencies:
  - TASK-9
  - TASK-10
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The nav item 'Inningen' (src/Lijst.tsx, drankleider-only) is the last stub — the branch that renders 'Komt nog.' even carries a ponytail comment saying so. TASK-9 gave every leider a way to claim 'ik heb overgeschreven' (status 'gemeld' at periods/{pid}/betalingen/{personRef}), but nobody can confirm it: only a drankleider may write 'betaald', and there is no screen to do it from. This task builds that screen from design/'Streepkeslijst App.dc.html' (markup lines 393-489, logic lines 1593-1665).

Inningen is the drankleider's reconcile-against-the-bank-statement screen for one closed period at a time: a period pager (arrows + dots, swipe left/right), three counters (BETAALD / NA TE KIJKEN / NOG OPEN), a filter row (Alles · Open · Na te kijken · Betaald), and a per-person list showing nick, status chip and amount with one primary action — 'Ontvangen · vink af' sets 'betaald', and on an already-paid person it flips to 'Terug openzetten'. 'gemeld' is only a claim: it stays amber 'na te kijken' until the drankleider ticks it off.

Written against TASK-10's model, not the frozen archive the earlier draft of this task assumed. There is no useArchief() and no frozen totals anymore: periods all live in the one 'periods' collection (data.ts usePeriodes), and an amount is derived from that period's own entries at that period's own prijs/bakPrijs (useEntries + period.ts totals()/bedrag()), exactly as Betalen does it. That is still the money at the prices the period ran at — derived instead of stored — and what the freeze used to protect (editing an old entry to shrink a settled bill) is now firestore.rules's binnenPeriode(): entries are only writable while their period is the active one. Which periods appear here reuses Betalen's rule, so both screens show the same set: eind != null && eind < vandaag, because a period closed with an eind in the future is still being streeped on and has no bill yet.

Guests matter here. They have no account, so they can never claim anything themselves; a guest's row is ticked off by the drankleider like anyone else's, which is exactly why TASK-9 keyed the status doc by personRef ('user:uid' / 'guest:gid') instead of uid. Guests are per-period (periods/{pid}/guests), so the screen resolves nicks against the selected period's own guest list, not the active period's. The Firestore rules already allow the writes — a drankleider may create, update and delete any betalingen doc, guests included — so no rules change is expected.

Out of scope: the mail/group-message block (design's innBericht* card, 'Mail alle N' and 'Deel in de groep') and the per-person 'Por · delen' nudge. Both are share/mail plumbing that the design fakes with a toast and a share sheet; they consume the same payment status and get their own task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A drankleider opening 'Inningen' sees one closed period at a time and can page through all of them with the arrows, the dots, and a left/right swipe
- [x] #2 The same periods are offered here as in Betalen: closed and past their eind (eind != null && eind < vandaag), most recent first
- [x] #3 The counters show how many people are betaald, gemeld ('na te kijken') and open for the selected period, and the header sub-line shows the number of people plus the open and total amounts
- [x] #4 Every person with an amount in the selected period is listed with nick, status chip (BETAALD / NA TE KIJKEN / OPEN) and their amount, derived from that period's own entries at that period's own prijs/bakPrijs
- [x] #5 The filter row limits the list to Alles / Open / Na te kijken / Betaald
- [x] #6 'Ontvangen · vink af' sets that person's status to 'betaald' with a toast; on a paid person the button reads 'Terug openzetten' and clears the status back to open
- [x] #7 Guests (personRef 'guest:...') appear in the list with the nick from the selected period's own guests and can be ticked off and reopened just like members
- [x] #8 Inningen writes nothing but betalingen docs — never the period doc, its prices or its entries — and is unreachable for anyone who is not a drankleider
- [x] #9 Tests cover the period pager, the counters, the filters, the afvink/heropen flow (incl. a guest), and that two periods with different prijs/bakPrijs each bill at their own prices
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. data.ts: add `useBetalingen(pid)` — one onSnapshot on periods/{pid}/betalingen returning Map<personRef, BetalingStatus> — and `vinkAfBetaling(pid, personRef, byUid)` (setDoc status 'betaald', at, by). Reopening reuses the existing herroepBetaling (deleteDoc = open). No rules change: firestore.rules:104-110 already lets a drankleider create/update/delete any betalingen doc, guest refs included.

2. src/Inningen.tsx, new screen component, ported from design/'Streepkeslijst App.dc.html' (markup 393-489, logic 1593-1665), Dutch copy verbatim, same house style as Betalen.tsx (starts at the subtitle, header row stays in Lijst.tsx):
   - props: { user, periodes, onToast }. Inside: local `nr` state for the selected period, usePeople(pid) for that period's own guests, useEntries(pid) + period.ts totals() for the amounts, useBetalingen(pid) for the statuses.
   - period list = periodes.filter(p => p.eind != null && p.eind < vandaag).sort(desc by nr) — the same expression Betalen uses, so both screens agree on what is billable.
   - rows = every personRef with a non-zero amount in that period's totals, nick from usePeople, bedrag(t, period.prijs, period.bakPrijs).
   - pager: prev/next arrows (dimmed at the ends), dots, and the design's touchstart/touchend swipe (>45px threshold); changing period resets the filter to 'alles'.
   - counters BETAALD / NA TE KIJKEN / NOG OPEN + the sub-line 'N leiders · €open open · €totaal totaal'.
   - filter row Alles · Open · Na te kijken · Betaald.
   - per row: nick, status chip, amount, one button — 'Ontvangen · vink af' -> vinkAfBetaling + toast '<nick> afgevinkt · €X ontvangen'; on a paid row 'Terug openzetten' -> herroepBetaling + toast '<nick> staat weer open'.
   - explicitly not ported: the innBericht* mail/group-message card and the per-row 'Por · delen' button (out of scope, own task).

3. Lijst.tsx: replace the 'Komt nog.' fallback branch for Inningen with <Inningen .../> and drop the ponytail stub comment above it. The route guard already gates it on drankleider (alleNav + magRol), so AC8's unreachable-for-non-drankleiders half needs no new code — only a test.

4. src/Inningen.test.tsx, same idiom as Betalen.test.tsx (vi.mock('./data') over an in-memory store + listener set so a write re-renders through the hook): pager (arrows/dots/swipe), the billable-period filter, counters, each filter chip, afvink + heropen incl. a guest:g1 row, and two periods at different prijs/bakPrijs each billing at their own prices. Non-drankleider unreachability is covered in Lijst.test.tsx against the existing route guard.

5. Verify: npm test && npm run build (build is the typecheck). Inningen's only write path is betalingen, which is the other half of AC8.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented data.ts useBetalingen/vinkAfBetaling, Inningen.tsx, wired into Lijst.tsx replacing the Komt-nog stub. npm run build passes.

Added src/Inningen.test.tsx (10 tests, Betalen.test.tsx idiom) covering pager (arrows+swipe), counters, filters, afvink/heropen incl. guest, and per-period pricing. npm test: 118/118 pass. npm run build passes (typecheck). Added data-pijl/data-teller/data-row/data-swipe attributes to Inningen.tsx for stable test selectors, same convention as Lijst.tsx's data-row/data-stat.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the Inningen screen (src/Inningen.tsx) per the recorded plan: a period pager (arrows, dots, and a >45px touch swipe) over the billable periods (eind != null && eind < vandaag, same expression as Betalen, newest first), three counters (BETAALD/NA TE KIJKEN/NOG OPEN) plus a header sub-line with people count and open/total euros, a filter row (Alles/Open/Na te kijken/Betaald), and per-person rows (nick, status chip, amount) with one action that calls the new data.ts vinkAfBetaling (setDoc status betaald) or the existing herroepBetaling (deleteDoc = open). Amounts are derived per period via useEntries + period.ts totals()/bedrag() at that period's own prijs/bakPrijs; guests resolve through usePeople(pid) against the selected period's own guest list. Wired into Lijst.tsx replacing the 'Komt nog.' stub and its ponytail comment; the existing magRol/alleNav route guard already restricts it to a drankleider. Verified with npm test (119/119 passing, including the new src/Inningen.test.tsx's 11 tests covering the pager (arrows/dots/swipe), AC2's billable-period filter, AC3's counters/sub-line, AC5's four filters, AC6/AC7's afvink+heropen flow for both a member and a guest, and AC9's two-periods-two-prices case) and npm run build (tsc typecheck + vite build, clean). AC8's write-scope half is evidenced by Inningen.tsx only importing vinkAfBetaling/herroepBetaling from data.ts (no period/entry writers); its unreachable-for-non-drankleider half is covered by the existing Lijst.test.tsx route-guard test, unchanged and still passing. No firestore.rules change was needed or made (rules already permit a drankleider's betalingen writes, guests included).
<!-- SECTION:FINAL_SUMMARY:END -->
