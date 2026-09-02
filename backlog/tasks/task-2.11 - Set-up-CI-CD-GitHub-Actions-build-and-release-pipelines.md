---
id: TASK-2.11
title: 'Set up CI/CD: GitHub Actions build and release pipelines'
status: Done
assignee:
  - '@sander'
created_date: '2026-09-01 06:47'
updated_date: '2026-09-02 21:15'
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
- [x] #1 A CI workflow runs on pull requests and pushes: install deps, lint/typecheck, build, run tests, and fails the check on any failure
- [x] #2 A release workflow deploys the built app to Firebase Hosting, wired to the Develop Firestore/Firebase project for non-production deploys and Prod for production releases
- [x] #3 Firebase deploy credentials are stored as GitHub encrypted secrets, not committed to the repo
- [x] #4 Merging to the main/release branch triggers a Prod deploy without manual steps
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Single workflow .github/workflows/ci.yml, one job build-and-deploy, runs on pull_request and push to main.
2. Steps: checkout, setup-node@v4 (node 22, cache npm), npm ci, npm run build (tsc -b typecheck + vite build), npm test, deploy.
3. Build env VITE_FIRESTORE_DB = prod on main, develop otherwise — one Firebase project, prod/develop are named Firestore databases selected at build time by src/firebase.ts, so environment separation lives in the bundle.
4. Deploy with FirebaseExtended/action-hosting-deploy@v0 (official; preview channels + PR comment with the URL). channelId 'live' on main, 'pr-<number>' otherwise (default 7d expiry).
5. Auth via secrets.FIREBASE_SERVICE_ACCOUNT — service account JSON in a GitHub encrypted secret, nothing committed. Manual one-time setup by the repo owner.
6. Linting dropped for now (no linter installed); tsc -b in the build step is the type gate.
7. Verify on the first PR: check fails on a broken test, preview URL comment appears and hits the develop database, then merge to main deploys live with prod.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planned only, not implemented.

Added .github/workflows/ci.yml. Verified npm run build and npm test pass locally (21 tests). Not yet run in CI — needs the FIREBASE_SERVICE_ACCOUNT secret before the deploy step can work.

Secret name is FIREBASE_SERVICE_ACCOUNT_STREEPKESLIJST (the name firebase init hosting:github creates).

CI run on the ci-cd PR passed end to end (reported by @sander): install/build/test green, deploy step authenticated with the FIREBASE_SERVICE_ACCOUNT_STREEPKESLIJST secret, preview channel URL posted on the PR, and Google sign-in worked on the preview domain without touching Auth authorized domains. AC 2 and 4 stay unchecked until a merge to main proves the live/prod deploy path. gh CLI cannot reach api.github.com from this machine (TLS interception), so run status came from the user.

Merge to main ran the workflow unattended: built with VITE_FIRESTORE_DB=prod, deployed to the live channel, and the live site was confirmed reading the prod Firestore database (verified by @sander). All four acceptance criteria now verified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added .github/workflows/ci.yml: a single build-and-deploy job on pull_request and push to main that runs npm ci, npm run build (tsc -b is the type gate), npm test, then deploys via FirebaseExtended/action-hosting-deploy. Environment separation is build-time — VITE_FIRESTORE_DB is prod on main and develop elsewhere, since the project has one Firebase project with prod/develop named Firestore databases. PRs get a preview channel (pr-<number>), main gets live. Credentials come from the FIREBASE_SERVICE_ACCOUNT_STREEPKESLIJST encrypted secret created by firebase init hosting:github; the two workflow files that command generated were deleted because they deploy without building. Linting was dropped from scope (no linter installed). Verified end to end: the PR run built, tested, posted a working preview URL with Google sign-in functional, and the merge to main deployed to live with the prod database in use.
<!-- SECTION:FINAL_SUMMARY:END -->
