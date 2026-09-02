---
id: TASK-1
title: Implement Google login via Firebase Auth
status: To Do
assignee: []
created_date: '2026-08-31 18:55'
updated_date: '2026-09-02 20:16'
labels:
  - infra
milestone: m-0
dependencies: []
type: task
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Leaders sign into the app using their Google account so consumption can be attributed to a real, authenticated person. This is the foundation for tracking who logs streepjes/BAKs (including on behalf of others) and for role-based access (drankleider).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can sign in with Google via Firebase Auth
- [ ] #2 Signed-in user's Firebase uid/profile (name, email, photo) is available in app state
- [ ] #3 Signed-out users are redirected to a login screen and cannot reach tracking screens
- [ ] #4 Users can sign out
- [ ] #5 First-time sign-in creates/links a corresponding user record in Firestore
- [ ] #6 With sign-in working, a write from the deployed app lands in the 'prod' database and a write from npm run dev lands in 'develop', closing TASK-2.1 AC #2 and #3
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/auth.ts — useAuth() hook: useState(user|undefined) + useEffect(onAuthStateChanged(auth, ...)). undefined = still loading, null = signed out, User = signed in. Export signIn = () => signInWithPopup(auth, googleProvider) and signOut = () => fbSignOut(auth). No context provider, no store: one hook called once in App and passed down. (AC #1, #2, #4)
2. First sign-in writes the user record: inside the onAuthStateChanged callback, when user is non-null, setDoc(doc(db, 'users', user.uid), { name: displayName, email, photoURL, lastLogin: serverTimestamp() }, { merge: true }). merge makes it idempotent — create on first login, refresh profile after. No separate 'is this the first time' check. (AC #5)
3. src/Login.tsx — one screen: logo/title + a single big 'Aanmelden met Google' button (mobile-first, full-width tap target), styled like the existing dark shell. Error state shown inline as text.
4. App.tsx gates on the hook: user === undefined -> null/spinner, user === null -> <Login/>, otherwise the app shell with the signed-in name + a sign-out button. This is the 'redirect' of AC #3: with no router installed there is no route to protect, so the guard is the render gate. Signed-out users never see tracking UI. Revisit when TASK-3 introduces routing.
5. Keep the existing Firestore ping button (now behind auth) as the verification for AC #6: run npm run dev, sign in, ping, confirm the doc appears in the 'develop' database; then npm run build + firebase deploy, sign in on the deployed URL, ping, confirm it lands in 'prod'. That closes TASK-2.1 AC #2/#3 too.
6. Prerequisites in the Firebase console: enable the Google sign-in provider, and add the Hosting domain(s) to Authorized domains or the popup fails in production only.
7. Tests: extend src/firebase.test.ts (or a new src/auth.test.ts) with a pure-function check only — the user-doc payload built from a Firebase User is worth one assert; onAuthStateChanged/popup wiring is not worth mocking the SDK for. Manual check per step 5 covers the rest.
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @sander
created: 2026-09-02 20:14
---
TASK-2.1 deployed the scaffold but could not verify its database-targeting ACs: firestore.rules requires request.auth != null and there was no sign-in yet. Verifying that is now the first checkable thing this task unblocks - see the AC added for it.
---
<!-- COMMENTS:END -->
