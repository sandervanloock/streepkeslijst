---
id: TASK-2.10
title: Make the app an installable PWA
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
