# Level Book

Offline differential-leveling field book for phones. HTML/CSS/vanilla JS, no build step. US survey decimal feet only.

**Live app:** https://ddlawler-theonly.github.io/level-book/

**Single-file version:** https://ddlawler-theonly.github.io/level-book/LevelBook.html (everything inlined in one HTML file; no service worker).

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
- **Peg Test (v1.1.0):** two-peg collimation check from the main menu; each loop/run can apply the latest peg test (Peg correction switch, can be turned off)

## Peg test & peg correction

- Setup 1 midway between pegs A and B (equal sights): read a1, b1. Setup 2 near peg A (default 10 ft behind A, so the B sight = spacing + 10 ft): read a2, b2.
- **C = [(a2 − b2) − (a1 − b1)] ÷ (dA − dB)**, shown in ft per 100 ft. C > 0 means the line of sight is inclined up and readings are too high.
- Pass/fail against a tolerance in Settings (default 0.005 ft per 100 ft, about 10″).
- **Corrected reading = reading − C × sight distance** on every BS/FS/IFS that has a distance (three-wire uses the stadia distance). Single-wire readings with no distance are used as read and marked "no dist".
- Turn it on or off on the setup screen, from the book's PEG button, or on the closure screen. Each book keeps a copy of the peg test it used ("Use latest peg test" swaps in a newer one). Raw readings are never changed.
- Reports state whether peg correction was applied, the C value and test date, and include the peg test record.

## Data

Stored in `localStorage` (key `levelbook.v1`) on the device only. Settings → Export backup (JSON) / Import backup. Peg tests are included in backups.

Unit tests: `node --test test.mjs`.

Service worker cache name is `levelbook-v1.1.0` (bump it when assets change).
