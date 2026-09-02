---
id: TASK-2.10
title: Make the app an installable PWA
status: In Progress
assignee:
  - '@sander'
created_date: '2026-09-01 06:47'
updated_date: '2026-09-02 21:20'
labels:
  - infra
milestone: m-0
dependencies:
  - TASK-2.1
parent_task_id: TASK-2
type: task
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the app into an installable Progressive Web App so leiders can add Streepkeslijst to their home screen and open it like a native app, matching the mobile-first/low-friction UX goal. Needs a web app manifest, icons, and a service worker for offline-tolerant loading of the shell.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Web app manifest (name, icons, theme/background color, start_url, display: standalone) is served and linked from the app
- [ ] #2 App is installable on iOS (Add to Home Screen) and Android/Chrome (install prompt), launching without browser chrome
- [ ] #3 A service worker caches the app shell so it loads (with a clear offline state for live data) when the network is unavailable
- [ ] #4 Lighthouse PWA installability checks pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add vite-plugin-pwa (devDep). A hand-rolled service worker cannot precache Vite's content-hashed asset filenames without reimplementing a build step, so the plugin is the smaller total change; registerType autoUpdate so a new deploy replaces a stale shell.
2. Configure VitePWA in vite.config.ts with the manifest inline: name/short_name Streepkeslijst, display standalone, start_url /, theme_color #121310, background_color #121310, lang nl, icons 192/512 + a maskable 512.
3. Icons: one hand-written public/icon.svg (lime #D8F651 tile with black tally strokes, matching design/Streepkeslijst App.dc.html colours), rasterised to PNG with rsvg-convert (already installed) — no font dependency, plain rects.
4. index.html: apple-touch-icon link for iOS Add to Home Screen (the manifest link is injected by the plugin).
5. Offline state for live data: small online/offline listener driving a banner, so a cached shell without network says so instead of looking empty. One vitest for that branch.
6. Verify: npm run build emits sw.js + manifest.webmanifest and the icons; npm run preview served locally to confirm they resolve; then the PR preview URL for real install on iOS and Android plus the Lighthouse installability audit (needs a real browser, so that check is the user's).
<!-- SECTION:PLAN:END -->
