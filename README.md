# BlueWorks Level Book

Offline differential-leveling field book for phones. HTML/CSS/vanilla JS, no build step. US survey decimal feet only.

**Live app:** https://ddlawler-theonly.github.io/level-book/

**Version:** 1.3.0

**Single-file version (older v1.2.1, no plan sheet / Pro features):** https://ddlawler-theonly.github.io/level-book/LevelBook.html (everything inlined in one HTML file; no service worker).

## Docs

- **User manual (PDF, 51 pages; also built into the app under Help & Manual):** https://ddlawler-theonly.github.io/level-book/docs/LevelBook-Manual.pdf
- **Field-trial tester sheet (PDF, 1 page, QR + install + what to try):** https://ddlawler-theonly.github.io/level-book/docs/LevelBook-Tester-Sheet.pdf
- **Privacy policy:** https://ddlawler-theonly.github.io/level-book/privacy.html
- **Support:** https://ddlawler-theonly.github.io/level-book/support.html
- **QR code to the app (SVG):** https://ddlawler-theonly.github.io/level-book/docs/LevelBook-QR.svg

## Install on iPhone

1. Open the live app link in **Safari** (not Chrome or another browser).
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Level Book** (BlueWorks Level Book) from your home screen. After the first load it works offline.

Android: open the link in Chrome → menu → **Install app** / Add to Home screen.

## Features

- Jobs list (create, search, archive, delete) with project date and description
- Loop, run, and site-level surveys
- Single-wire and three-wire reading methods
- Rod graphic, HI/elevation calculations, stadia distance, wire-spread checks
- Level book table, closure and adjustments, share as PDF / text / CSV
- **Peg Test (v1.1.0):** two-peg collimation check from the main menu; each loop/run can apply the latest peg test (Peg correction switch, can be turned off)
- **Stake Out (v1.2.0):** backsight a benchmark for HI, type a design elevation, read the target rod, then shoot the actual rod for CUT / FILL to 0.01 ft
- **Use distance switch (v1.2.0):** every screen that asks for a sight distance has a switch to use or ignore distances
- **v1.2.1:** app renamed **BlueWorks Level Book** (home-screen label stays "Level Book"); reports, share titles and feedback subject use the new name. Data is kept.
- **Report import (preview):** every PDF report carries the full survey data invisibly (XMP metadata). **IMPORT PDF** on the Jobs screen rebuilds the job; **Import survey from PDF report** inside a job adds its surveys. Older PDFs without data get a friendly message. Plan sheet pins are not carried.
- **Three-wire running distance totals (preview):** live ΣBS / ΣFS stadia distance, balance (ΣBS − ΣFS) and total on the three-wire entry screen; THREE-WIRE DISTANCE TOTALS table in PDF/preview, plus text and CSV.
- **Open Level Run (preview):** the closing benchmark on a Level Run is optional. Leave it blank and the run ends on a set point (the last foresight, named in the FINISH RUN dialog); its elevation is the result, with the arithmetic check and distance totals but no misclosure/allowable ("Open run, no closing check"). A known elevation can be added later on the result screen to turn on the closure check (and removed again). Reports and PDF import handle open runs.
- **Pipe Slope Calculator (preview, free):** main menu → Pipe Slope. Starting flow line elevation, then sections (length ft, slope %, Drop/Rise per section); each end is the next start; table + totals, inline validation, TEXT/CSV export; inputs kept on the device, works offline.
- **Field trial (v1.2.0):** TRIAL badge, one-time welcome card, and **Send feedback** (header button or Settings)

## Stake Out

1. Main menu → **Stake Out** (just above Peg Test). Enter the start benchmark and its elevation.
2. Backsight the BM: **HI = BM elevation + BS**.
3. For each stake type the **design elevation**: **target rod = HI − design** (blue dashed marker on the rod).
4. Shoot the rod at the stake: **ground = HI − rod**, **cut/fill = ground − design**. Positive = **CUT** (red), negative = **FILL** (blue), under 0.005 ft = **ON GRADE**.
5. If the target is above the line of sight or past the rod length you get a warning; you can still save.
6. **Next stake**, **New setup (BS)** after moving the level, then **Finish** to share the stake sheet (PDF / text / CSV).

## Use distance switch

- On the survey setup screen, the entry screens (loop/run/site/stake), the closure screen, and as a default in Settings.
- **ON:** distances feed peg correction, sight-balance and max-sight warnings, total distance and distance-based allowable closure / adjustment.
- **OFF:** readings are used as read; no peg correction, no balance warnings, allowable closure shows n/a and adjustment is per setup. Distances you typed are kept and come back if you turn it on again.
- Peg Test always uses distances (switch locked on). Reports show "Distances: used / not used".

## Field trial feedback

Tap the speech-bubble button at the top of the Jobs or main-menu screen (or Settings → Send feedback). Pick a 1–5 rating and a category (bug / idea / looks / math), add notes, and optionally attach the current survey report as a PDF. It opens your phone's share sheet; if sharing is not available it opens an email to ddlawler@hotmail.com with subject "BlueWorks Level Book feedback v1.2.1". App version, device, screen size, theme and the current screen are added automatically. Nothing is sent without you tapping Send in your mail or messaging app.

## Peg test & peg correction

- Setup 1 midway between pegs A and B (equal sights): read a1, b1. Setup 2 near peg A (default 10 ft behind A, so the B sight = spacing + 10 ft): read a2, b2.
- **C = [(a2 − b2) − (a1 − b1)] ÷ (dA − dB)**, shown in ft per 100 ft. C > 0 means the line of sight is inclined up and readings are too high.
- Pass/fail against a tolerance in Settings (default 0.005 ft per 100 ft, about 10″).
- **Corrected reading = reading − C × sight distance** on every BS/FS/IFS that has a distance (three-wire uses the stadia distance). Single-wire readings with no distance are used as read and marked "no dist".
- Turn it on or off on the setup screen, from the book's PEG button, or on the closure screen. Each book keeps a copy of the peg test it used ("Use latest peg test" swaps in a newer one). Raw readings are never changed.
- Reports state whether peg correction was applied, the C value and test date, and include the peg test record.

## Data

Stored in `localStorage` (key `levelbook.v1`) on the device only. Settings → Export backup (JSON) / Import backup. Peg tests are included in backups. A sample job (Pearland) includes a loop, a run and a stake-out survey.

Unit tests: `node --test test.mjs test-import.mjs test-openrun.mjs test-pipe.mjs`. Browser suites: `node tools/e2e*.mjs chromium|webkit` (LB_BASE = preview URL).

Service worker cache name is `levelbook-v1.2.1` (bump it when assets change).
