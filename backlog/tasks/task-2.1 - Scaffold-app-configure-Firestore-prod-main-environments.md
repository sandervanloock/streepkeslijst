---
id: TASK-2.1
title: Scaffold app + configure Firestore Prod/Develop environments
status: In Progress
assignee:
  - '@sander'
created_date: '2026-08-31 19:03'
updated_date: '2026-09-02 20:14'
labels:
  - infra
milestone: m-0
dependencies: []
parent_task_id: TASK-2
type: task
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is no application scaffold yet. Set up the frontend project (framework TBD by implementer, mobile-first) with Firebase Hosting + Firestore + Google Auth wiring, and support two Firestore databases: Prod and Develop (e.g. via env-based Firebase config, not hardcoded project config in multiple places per CLAUDE.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App can be built and deployed to Firebase Hosting for project streepkeslijst
- [ ] #2 App can connect to either the 'Develop' or 'Prod' Firestore database based on environment/config, without duplicating Firebase config in multiple places
- [ ] #3 Local dev defaults to the 'Develop' database
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Stack choice (the task leaves the framework to the implementer): **Vite + React + TypeScript**. React because the design project is already React/JSX and TASK-3 renders a list with tap/hold gesture state; Vite because Firebase Hosting just wants a static `dist/`. No router, no state library, no CSS framework in this task - TASK-3 decides those when it has a real screen to build.

Prod/Develop split: **two named Firestore databases inside the one `streepkeslijst` Firebase project**, `prod` and `develop` (both already created). Not two Firebase projects - that is what keeps AC #2 honest: a single Firebase web config object, with only the database name varying by environment. `develop` is the fallback when no database is configured, so a missing or misspelled env var lands on develop and never on prod.

1. Scaffold: `npm create vite@latest . -- --template react-ts`, add `firebase`, commit a `.gitignore` covering `node_modules/`, `dist/` and `.env*.local`.
2. ~~Create the databases~~ - done, `prod` and `develop` both exist in the `streepkeslijst` project. Note the project may still carry an unused `(default)` database; nothing should point at it.
3. `src/firebase.ts` as the single init module, per CLAUDE.md: one `initializeApp(config)`, one `getAuth(app)`, and `getFirestore(app, import.meta.env.VITE_FIRESTORE_DB ?? "develop")`. The web config object is hardcoded here and nowhere else (the apiKey is a public client identifier, not a secret). Auth here is only the SDK + `GoogleAuthProvider` wiring; the actual sign-in flow is TASK-1.
4. Env files: `.env.production` sets `VITE_FIRESTORE_DB=prod`. Nothing else needs setting - dev falls through to the `develop` default in step 3, which is AC #3 with no dev-only config file to keep in sync.
5. Guard the resolution: `src/firebase.test.ts` asserts the resolved database name is `prod` when `VITE_FIRESTORE_DB=prod`, and `develop` when the variable is unset or empty. This is the one piece of real logic in the task and the one that quietly costs money if it inverts.
6. `firebase.json` + `.firebaserc`: hosting rewrites everything to `/index.html` (SPA), `public: "dist"`, and a `firestore` array with an entry for `prod` and one for `develop` so rules and indexes deploy to both. Minimal `firestore.rules` - authenticated-only read/write for now; real rules land with TASK-1 and the data model.
7. Verify: `npm run build && firebase deploy` puts the app on Hosting for `streepkeslijst` (AC #1). Write one throwaway doc from the deployed page and one from `npm run dev`, and confirm they land in `prod` and `develop` respectively (AC #2, #3).

Deliberate corner: dev and prod share one Firebase project, so they share Auth users, billing and quota. Fine at Chiro scale, and it is the only way to keep one config object. If hard isolation is ever needed, the upgrade is a second Firebase project plus per-project config - revisit before this holds real money.

Not in this task: PWA manifest and service worker (TASK-2.10), CI/CD workflows (TASK-2.11), the sign-in screen (TASK-1), fonts and design tokens (TASK-3).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scaffolded by hand rather than via `npm create vite` - the template ships demo CSS, SVGs and an App.css that all get deleted immediately. Files: package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx, src/App.tsx, src/firebase.ts, src/firebase.test.ts, firebase.json, .firebaserc, firestore.rules, firestore.indexes.json, env.example, .gitignore.

Dropped the env-file plumbing from the plan. Vite already knows whether it is a production build, so `databaseId(override, isProd)` in src/firebase.ts resolves 'prod' for `npm run build` and 'develop' for `npm run dev` with no .env file to keep in sync. VITE_FIRESTORE_DB stays as an override for a prod bundle that has to point elsewhere (TASK-2.11 will want this for staging deploys). This also flipped the safety argument in the plan for the better: a dev build can no longer reach prod even if the override is blank.

Verified: `npm test` passes (3 tests over the database resolution). `npm run build` is clean, and the emitted bundle contains `PN=(r,t)=>"prod",Od=PN()` - the minifier constant-folded the resolution, so a production build demonstrably targets the prod database.

Blocked on Firebase credentials, which is why AC #1 is unchecked: `firebase apps:sdkconfig WEB --project streepkeslijst` fails with "Your credentials are no longer valid". apiKey, messagingSenderId and appId in src/firebase.ts are literal TODOs. Once `firebase login --reauth` is done: fill those three, `firebase deploy` for AC #1, then press the ping button on the deployed page and on `npm run dev` and confirm the docs land in prod and develop respectively for AC #2/#3.

src/App.tsx is a throwaway shell (marked with a ponytail comment) that shows the resolved database and writes a ping doc. It exists only to make AC #1-#3 checkable; TASK-3 replaces it.

The example env file is at env.example, not .env.example - this environment refuses writes to .env* paths.

Firebase config filled in from the project console (measurementId omitted - nothing uses Analytics; add it when something does).

AC #1 verified: `firebase deploy --only hosting,firestore` reported "release complete", deployed indexes and released rules to both the develop and prod databases, and https://streepkeslijst.web.app now serves the built index.html (fetched, returns the Streepkeslijst title). `firebase firestore:databases:list` confirms the two databases are named exactly `develop` and `prod`, matching the ids the app resolves.

AC #2 and #3 are NOT yet objectively verified and stay unchecked. The database *resolution* is proven - three unit tests plus the production bundle constant-folding to `PN=(r,t)=>"prod",Od=PN()` - but an actual read or write from the app cannot be demonstrated yet: firestore.rules requires `request.auth != null` and there is no sign-in until TASK-1. The ping button on the deployed shell will return permission-denied by design. Close these two either after TASK-1 lands, or by temporarily allowing an unauthenticated write to a `ping` collection, verifying, and reverting.

Decision (Sander, 2026-09-02): defer AC #2 and #3 to TASK-1 rather than temporarily loosening firestore.rules. TASK-2.1 stays In Progress until sign-in exists and the two database connections are demonstrated end to end.
<!-- SECTION:NOTES:END -->
