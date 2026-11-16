# Level Book

Offline differential-leveling field book for phones. HTML/CSS/vanilla JS, no build step. US survey decimal feet only.

**Live app:** https://ddlawler-theonly.github.io/level-book/

## Install on iPhone

1. Open the live app link in **Safari** (not Chrome or another browser).
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Level Book** from your home screen. After the first load it works offline.

Android: open the link in Chrome → menu → **Install app** / Add to Home screen.

## Features

- Jobs list (create, search, archive, delete) with project date and description
- Loop, run, and site-level surveys
- Single-wire and three-wire reading methods
- Rod graphic, HI/elevation calculations, stadia distance, wire-spread checks
- Level book table, closure and adjustments, share as PDF / text / CSV

## Data

Stored in `localStorage` (key `levelbook.v1`) on the device only. Settings → Export backup (JSON) / Import backup.

Service worker cache name is `levelbook-v1.0.3` (bump it when assets change).
