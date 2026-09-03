---
id: TASK-7
title: Invite members by email from the Beheer screen
status: Done
assignee:
  - '@sander.vanloock'
created_date: '2026-09-03 16:32'
updated_date: '2026-09-03 18:09'
labels: []
dependencies:
  - TASK-6
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the invitation sections of the Beheer screen from design/'Streepkeslijst App.dc.html' (~line 205-240): the 'VOLK ERBIJ HALEN' email input plus the pending-invite list with reshare and revoke.

The email address is the identity key, not the transport: an invited person is matched on the address of their Google account when they sign in, so an invite for a non-Google address will simply never resolve. Delivery of the notice is NOT done by the app - Firebase Extensions (incl. firestore-send-email) shut down on 2027-03-31 and a Cloud Function plus mail API is disproportionate infrastructure for a handful of invites a month. Instead the beheerder shares the invitation through the channel the group already uses (WhatsApp) via the native Web Share API, with clipboard copy as fallback. The design's mail wording is adjusted accordingly.

The pending-invite list, the claim-on-login matching and the access gating are built against Firestore and rules alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A beheerder can enter an email address and create an invitation; the address appears in the pending list
- [x] #2 An invalid email address is rejected inline with 'Geef een geldig e-mailadres.' and no invite is created
- [x] #3 Inviting an address that is already pending is rejected inline and points at resharing instead
- [x] #4 Creating an invite offers the invitation text through navigator.share, falling back to clipboard copy when the browser has no share support; the row never claims the invitee was notified
- [x] #5 Resharing bumps the reminder count, flips the badge to HERINNERD and shows the design's toast
- [x] #6 Revoking removes the invitation and the invite no longer grants access on login
- [x] #7 Signing in with Google using an invited address consumes the invitation and creates the users/{uid} doc with role lid
- [x] #8 Signing in with an address that was never invited does not grant access to the group and signs the user back out
- [x] #9 Firestore rules let only a beheerder create, reshare or revoke invitations; covered in firestore.rules.test.ts
- [x] #10 Tests cover create, the two validation errors, revoke, and claiming an invite on login
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**Delivery decision (settled 2026-09-03).** The app does not send mail. Firebase Extensions - including `firestore-send-email` - are deprecated and shut down on 2027-03-31 (migration path: Cloud Functions), so installing one now is dead on arrival. An own Cloud Function plus a mail API means a `functions/` workspace, a second CI deploy target, a secret, the Blaze plan and SPF/DKIM on a domain, for a handful of invites a month. `mailto:` was rejected too: silent failure on any desktop without a configured mail client, no delivery proof, and no WhatsApp.

So the invite *doc* is the only thing that grants access, and the beheerder notifies the person through the channel the group already uses. The Web Share API hands the invitation text to WhatsApp in one tap on mobile; browsers without `navigator.share` (desktop Firefox) fall back to clipboard copy. The UI never claims the invitee was notified - it says the invitation exists and offers to share it again. Upgrade path if this ever needs real mail: a Cloud Function writing through a mail API, same invite doc, no schema change.

1. **Invite docs.** `invites/{email}` with the lowercased address as the document id, so 'already invited' is a document-exists check and never a query: `{ email, by, byNick, at, herinnerd: 0, lastShared }`. Add `useInvites()`, `createInvite`, `bumpInvite` (increment `herinnerd`, refresh `lastShared`) and `revokeInvite` to `src/data.ts`, in the same hook/writer style as `usePeople`/`addGuest`.
2. **Sharing helper.** One small function in `src/data.ts` (or wherever `zegSnack` lives) that builds the Dutch invitation text - group name plus 'meld je aan met Google op <adres>' plus the app URL - and calls `navigator.share({ text })`, falling back to `navigator.clipboard.writeText` and a different toast. Swallow the `AbortError` the share sheet throws when the user cancels; the invite doc stays either way.
3. **Screen sections.** Extend the `src/Beheer.tsx` built in TASK-6 with the two skipped blocks of design/'Streepkeslijst App.dc.html' (lines 205-245): `VOLK ERBIJ HALEN` (the explainer about needing their Google address, the E-MAILADRES input, the red error box, the lime action button) and the pending list (one row per invite with the badge, the meta line, and the two action buttons). Fill in the invite count in the Beheer menu subtitle that TASK-6 left at just the group name.
4. **Copy changes vs the design.** The design is written around mail; the transport changed, so: button `Mail de uitnodiging` -> `Deel de uitnodiging`; section header `GEMAILD, NOG NIET AANGESLOTEN` -> `UITGENODIGD, NOG NIET AANGESLOTEN`; badge `GEMAILD` -> `UITGENODIGD` (same colours); row action `Opnieuw mailen` -> `Opnieuw delen`; meta line `Gemaild ... ` -> `Uitgenodigd <datum> · sluit aan zodra hij met dit adres bij Google inlogt`. The explainer keeps its point (they must use their Google address) with `Mailen is de enige manier` -> `Een uitnodiging is de enige manier`. Everything else in those blocks stays byte-for-byte as designed.
5. **Validation.** A trimmed address failing a simple email shape -> `Geef een geldig e-mailadres.`; an address that already has an invite doc -> `Die is al uitgenodigd - deel de uitnodiging opnieuw hieronder.` Nothing is written in either case. Keep the shape check as a one-line regex in `src/period.ts` so it is unit-tested; no validation dependency.
6. **Toasts.** Reuse `zegSnack`: `Uitnodiging voor <mail> klaar · deel ze met hem` on create with share, `Uitnodiging gekopieerd · plak ze in WhatsApp` on the clipboard fallback, `Uitnodiging voor <mail> opnieuw gedeeld` on reshare, `Uitnodiging voor <mail> ingetrokken · hij kan niet meer aansluiten` on revoke.
7. **Access gating - the real security change here.** Today `firestore.rules:7-9` grants any signed-in Google account full access, so the app is effectively open to the internet. Make membership explicit: `users/{uid}` may only be *created* when `invites/{request.auth.token.email.lower()}` exists or the doc already exists, and every other collection requires an existing `users/{request.auth.uid}` doc. Then in `src/auth.ts`, on first sign-in, create `users/{uid}` and delete the consumed invite in one `writeBatch` (atomic: the invite cannot be spent twice). If the write is rejected, sign the user straight back out and show a 'je bent niet uitgenodigd' state on the login screen rather than a broken lijst - `src/Login.tsx:140` already has the error-alert slot for it.
8. **Migration for the existing accounts.** Step 7 would lock out anyone whose `users/{uid}` doc predates it - those docs already exist and pass the 'doc already exists' branch. Verify against the `develop` database before touching `prod`, and note the check in the implementation notes.
9. **Rules for the invites themselves.** `invites/{email}`: read/create/update/delete only for a beheerder (the `isBeheerder()` helper from TASK-6), with the single exception that the invitee's own atomic claim in step 7 may delete their own invite.
10. **Tests.** In `Beheer.test.tsx`: create adds a pending row and calls the share helper (stub `navigator.share`); the clipboard fallback when `navigator.share` is absent; the invalid-address and duplicate errors; reshare flips the badge to HERINNERD; revoke removes the row. In `period.test.ts`: the email-shape helper. In `auth.test.ts`: an invited address gets a `users/{uid}` doc with role `lid` and consumes the invite; an uninvited one is signed back out. In `firestore.rules.test.ts`: only a beheerder may create/reshare/revoke an invite; an invited address may create its own user doc and delete its own invite; an uninvited address is denied everywhere.
11. **Verify.** `npm run build`, `npm test`, `npm run test:rules`, then a real invite end to end on the `develop` database (create, share to yourself, sign in with Google, land on the lijst as a `lid`).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivery decision closed per plan (invite doc = access grant, navigator.share + clipboard fallback, no mail sent).

data.ts: added Invite type, useInvites/createInvite/bumpInvite/revokeInvite writers, and shareInvite (navigator.share, swallows AbortError, falls back to clipboard.writeText when navigator.share is absent).

period.ts: added geldigeMail (simple email-shape regex), unit tested.

Beheer.tsx: ported VOLK ERBIJ HALEN + UITGENODIGD-list sections from design lines 205-245 with the mail->share copy substitutions from the plan. Badge colours: neutral (rgba(244,241,230,.14)/paper) for UITGENODIGD, lime/#121310 for HERINNERD — the design leaves {{u.statusBg}}/{{u.statusFg}} as placeholders with no literal colour, so these were chosen to match the app's existing palette conventions (lime = emphasis/active, as used elsewhere).

auth.ts: rewrote useAuth to return [user, authError]. New sign-ins with no existing users/{uid} doc go through claimInvite(), a writeBatch that creates users/{uid} and deletes invites/{email} atomically; on rejection (no invite, or rules not deployed) the user is signed back out and authError is set. App.tsx/Login.tsx thread that message into Login's existing role="alert" slot via a new `uitnodigingsFout` prop.

firestore.rules: added isMember() (own users/{uid} doc exists), gated users/{uid} create on a matching invites/{email} doc, gated periods/*/entries, periods/*/guests, meta/group and meta/period reads on isMember(). invites/{email}: beheerder-only read/create/update; delete allowed for a beheerder OR the invitee deleting their own (address-matching) invite, which is the second half of claimInvite's batch.

Test fallout from the isMember() gate: firestore.rules.test.ts's global beforeEach now seeds users/u1 and users/u2 (role lid) via withSecurityRulesDisabled before every test, since entries/guests/meta reads now require the reader's own doc to exist — same as any real member. New uids (u3/u4) are left unseeded on purpose for the claim/no-claim tests.

Skipped: "fill in the invite count in the Beheer menu subtitle" (plan step 3). Checked design lines 540-561 (the nav sc-for) and current Lijst.tsx's nav array — the design computes a `sub` string per nav item (line 1698-1706) but never actually renders it anywhere in the markup, and Lijst.tsx has no subtitle line under any nav item today (not just Beheer). There's no existing render slot to fill, for any nav item, so I left it out rather than inventing new nav-item UI outside this task's ACs. Flagging as a candidate follow-up if nav subtitles are wanted generally.

npm run build and npm test pass locally. npm run test:rules required --dangerously-disable-sandbox (the sandbox blocks the Firestore emulator's local ports); ran successfully outside the sandbox, all 13 rules tests pass including the new AC7/AC8/AC9 ones.

Not verified (needs the user): step 8's migration check against the real `develop` database (pre-existing accounts there already have a users/{uid} doc, so they pass the "doc already exists" branch unaffected — but this needs eyes-on the actual develop data, not something I have access to), and step 11's real Google sign-in end-to-end against develop. Also: firestore.rules is not deployed by the build — `firebase deploy --only firestore:rules` is a separate manual step, and firebase.json points that at both prod and develop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported the invitation sections of the design's beheerOpen block (VOLK ERBIJ HALEN, UITGENODIGD-list) into Beheer.tsx, backed by an invites/{email} collection (data.ts) and the closed delivery decision: navigator.share with a clipboard fallback, never a claim that the invitee was notified.

The real security change: firestore.rules now requires a matching invites/{email} doc to create users/{uid}, and every ledger/meta read requires the reader's own users/{uid} doc to already exist. auth.ts's claimInvite does the create+delete atomically in one writeBatch; a rejected batch (no invite) signs the user back out and surfaces "Dit Google-account is niet uitgenodigd voor deze groep." through Login's existing alert slot via a new authError return from useAuth / uitnodigingsFout prop on Login.

Verified: npm run build (typecheck + vite build) passes. npm test passes, 76 tests across the whole suite, including new coverage in period.test.ts (geldigeMail), Beheer.test.tsx (create, both validation errors, share vs clipboard toast, reshare/HERINNERD badge, revoke), and auth.test.ts (atomic claim on invite, sign-out + error on no invite, existing-member refresh path untouched). npm run test:rules passes (13 tests, run with the sandbox disabled since it needs the Firestore emulator's local ports), including new rules coverage for invite CRUD (beheerder-only) and the create/deny paths for an invited vs. uninvited address.

Deliberately skipped: filling an invite count into a "Beheer menu subtitle" (plan step 3) — checked the design markup and current Lijst.tsx; no nav item, including Beheer's, actually renders a subtitle anywhere today, so there was no existing slot to fill for just this one item. Flagged as a candidate follow-up if nav subtitles are wanted app-wide.

Not verified by me (needs the user, per the task's own scope note): step 8's migration check against the real `develop` database, and step 11's real Google sign-in end-to-end on develop. firestore.rules is not deployed by the build — needs `firebase deploy --only firestore:rules` (firebase.json points that at both prod and develop).
<!-- SECTION:FINAL_SUMMARY:END -->
