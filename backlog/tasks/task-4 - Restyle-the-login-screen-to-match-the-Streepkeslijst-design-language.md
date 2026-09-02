---
id: TASK-4
title: Restyle the login screen to match the Streepkeslijst design language
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 21:22'
updated_date: '2026-09-02 21:46'
labels:
  - ui
  - design
dependencies:
  - TASK-1
  - TASK-3
references:
  - design/Streepkeslijst App.dc.html
  - >-
    https://claude.ai/design/p/097faf3b-4460-408e-9cce-6565e1e6e93a?file=Streepkeslijst+App.dc.html
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/Login.tsx is still the placeholder from TASK-1: a bare Google button on an unstyled page. It is the first screen anyone sees, so it should look like the rest of the app. The Claude Design file has no login screen, so derive the look from the design language already used on the lijst screen (TASK-3) instead of inventing a new direction: canvas #121310 with the faint lime radial glow and scanline texture, cards #1B1D17, paper text #F4F1E6, lime #D8F651 as the primary accent, Anton for the uppercase display title and Space Grotesk for body/UI. Mobile-first, single big tap target, Dutch copy. No new screens or auth behaviour - the sign-in flow, error handling and the users/{uid} write from TASK-1 stay exactly as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Login screen uses the same canvas, glow, texture, colours and fonts as the lijst screen
- [x] #2 Streepkeslijst wordmark/title shown in Anton uppercase above the sign-in action
- [x] #3 Single full-width 'Aanmelden met Google' button, lime accent, comfortable mobile tap target
- [x] #4 Sign-in errors are still shown inline and readable against the dark canvas
- [x] #5 Auth behaviour is unchanged: same signIn call, same render gate in App.tsx, existing tests stay green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Restyle src/Login.tsx only: drop the opaque background so the body glow/scanline shows, Anton uppercase wordmark + CHIRO ELZESTRAAT eyebrow, lime full-width button (min 56px), inline error in the red card style from Lijst.tsx.
2. Keep signIn()/error state/App.tsx gate untouched.
3. npm run build + npm test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restyled src/Login.tsx only. Dropped the opaque #121310 background so the body radial glow + scanline (index.html) shows through; added the CHIRO ELZESTRAAT eyebrow, Anton uppercase wordmark, Space Grotesk sub-copy, a full-width lime button (min-height 58) and the red inline error card reused from Lijst.tsx. Content is top-aligned with 24px top padding per user request (less whitespace above the wordmark). No new deps, no CSS files. New src/Login.test.tsx asserts the Anton uppercase heading, lime full-width >=44px button, transparent main (glow not covered) and the inline role=alert error after a rejected signIn. Verified: npm test 7 files / 24 tests passed, npm run build (tsc -b + vite) clean.

Layout tweak after review: block is vertically centred again (justifyContent center) with 24px top / 64px bottom padding so it lands slightly above true middle.

Layout follow-up: the button itself now sits on the screen's vertical midline — header wrapper and a trailing spacer both flex:1, button flex:none, symmetric 24px vertical padding. The error card lives in the bottom spacer so the button does not shift when it appears.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Login screen now matches the lijst design language: transparent canvas over the body glow/scanline, Anton uppercase Streepkeslijst wordmark with a CHIRO ELZESTRAAT eyebrow, single full-width lime 'Aanmelden met Google' button (58px tap target) and errors in the red inline card style. signIn(), the error state and the App.tsx render gate are untouched. Verified with a new src/Login.test.tsx (heading font/uppercase, button colour/width/height, transparent main, inline role=alert on a rejected sign-in) plus the full suite: 24 tests green and npm run build clean.
<!-- SECTION:FINAL_SUMMARY:END -->
