---
id: TASK-2
title: Infra setup
status: Done
assignee: []
created_date: '2026-09-02 19:58'
updated_date: '2026-09-02 21:40'
labels:
  - infra
milestone: m-0
dependencies: []
type: task
ordinal: 500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Umbrella for the groundwork that has to exist before any product screen can be built: the app scaffold, Firebase Hosting, the Prod/Develop Firestore environments, Google sign-in, PWA packaging and CI/CD. Nothing under this task is user-facing product behaviour - it is the platform the Streepkeslijst screens get built on.

Work through the subtasks; each one is independently shippable. This task is done when a signed-in leider can open a deployed, installable app shell against the right Firestore environment, built and released by CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The app scaffold builds and deploys to Firebase Hosting for project streepkeslijst
- [x] #2 Local dev runs against the Develop Firestore database and production against Prod, from a single Firebase config source
- [x] #3 A leider can sign in with Google and is kept out of the app when signed out
- [x] #4 The deployed app is installable as a PWA on iOS and Android
- [x] #5 CI checks every pull request and merging to main deploys to Prod without manual steps
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All three subtasks are Done: TASK-2.1 (scaffold + Prod/Develop Firestore), TASK-2.11 (CI/CD) and TASK-2.10 (PWA); Google sign-in shipped in TASK-1. Evidence per criterion: #1 and #5 from the CI pipeline - a PR builds, tests and deploys a preview channel, and the merge to main deployed to Firebase Hosting live unattended; #2 from src/firebase.ts selecting the prod database in a production build and develop otherwise, confirmed live (prod site reads prod) and in the dev/preview builds; #3 from the Google sign-in flow working on the deployed app with signed-out users kept on the Login screen; #4 from installing the deployed app standalone on iOS and Android with the Lighthouse installability audit passing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Platform groundwork complete: a signed-in leider can open the deployed, installable Streepkeslijst shell against the right Firestore environment, built and released by CI. Delivered across TASK-2.1 (Vite/React/TS scaffold, Firebase Hosting, prod+develop named Firestore databases from a single config source), TASK-1 (Google sign-in), TASK-2.11 (.github/workflows/ci.yml: build, typecheck and tests on every PR with a develop-backed preview channel, live prod deploy on main) and TASK-2.10 (manifest, icons, precaching service worker, offline banner and Firestore persistence). Verified by the green CI runs and live deploy plus manual checks on the deployed app: sign-in, prod database in use, standalone install on iOS and Android, Lighthouse installability, and an offline reload serving cached streepjes.
<!-- SECTION:FINAL_SUMMARY:END -->
