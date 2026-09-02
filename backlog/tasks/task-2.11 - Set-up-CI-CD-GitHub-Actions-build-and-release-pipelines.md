---
id: TASK-2.11
title: 'Set up CI/CD: GitHub Actions build and release pipelines'
status: To Do
assignee: []
created_date: '2026-09-01 06:47'
updated_date: '2026-09-02 19:57'
labels:
  - infra
milestone: m-0
dependencies:
  - TASK-2.1
parent_task_id: TASK-2
type: task
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add GitHub Actions workflows to build, check, and deploy the app to Firebase Hosting. Needs a CI workflow that runs on PRs/pushes (install, lint/typecheck, build, tests) and a release workflow that deploys to Firebase Hosting, targeting the Develop Firestore/Firebase environment for non-main branches and the Prod environment on release/main, using repo secrets for Firebase credentials.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A CI workflow runs on pull requests and pushes: install deps, lint/typecheck, build, run tests, and fails the check on any failure
- [ ] #2 A release workflow deploys the built app to Firebase Hosting, wired to the Develop Firestore/Firebase project for non-production deploys and Prod for production releases
- [ ] #3 Firebase deploy credentials are stored as GitHub encrypted secrets, not committed to the repo
- [ ] #4 Merging to the main/release branch triggers a Prod deploy without manual steps
<!-- AC:END -->
