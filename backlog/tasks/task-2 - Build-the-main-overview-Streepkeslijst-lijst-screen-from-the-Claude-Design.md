---
id: TASK-2
title: Infra setup
status: To Do
assignee: []
created_date: '2026-09-02 19:58'
updated_date: '2026-09-02 19:58'
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
- [ ] #1 The app scaffold builds and deploys to Firebase Hosting for project streepkeslijst
- [ ] #2 Local dev runs against the Develop Firestore database and production against Prod, from a single Firebase config source
- [ ] #3 A leider can sign in with Google and is kept out of the app when signed out
- [ ] #4 The deployed app is installable as a PWA on iOS and Android
- [ ] #5 CI checks every pull request and merging to main deploys to Prod without manual steps
<!-- AC:END -->
