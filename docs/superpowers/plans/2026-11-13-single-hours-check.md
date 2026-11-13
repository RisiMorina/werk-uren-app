# Single hours check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Mijn uren", a small installable app in `single-hours-check/` where one person logs hours worked per day or marks a day as not worked (vrij, ziek, vakantie, feestdag), with a month overview, Excel export and backup.

**Architecture:** One self-contained folder with its own `js/logic.js` (pure rules, tested in Node) and `js/app.js` (screens, storage). Data is one object in `localStorage`; one record per date. PWA with service worker.

**Tech Stack:** Plain HTML, CSS, JavaScript. No libraries. Node for tests (`node single-hours-check/test/test.js`).

**Spec:** `docs/superpowers/specs/2026-11-13-single-hours-check-design.md`

## Global Constraints

- All code and assets live in `single-hours-check/`. Nothing depends on files outside it.
- Dutch interface, no English words, no em-dashes. App name "Mijn uren".
- Text at least 18px, buttons at least 48px high, mobile first (375px), no sideways scroll.
- Weeks follow ISO (Monday first). Dates are local `YYYY-MM-DD`, never UTC.
- Hours shown with a comma (`7,5`). CSV: semicolon, decimal comma, UTF-8 with BOM, CRLF.
- Reasons exactly: Vrij, Ziek, Vakantie, Feestdag. One record per date.
- Not saved: 0 hours, more than 24 hours, negative pause (a pause is whole minutes, never below 0). Over midnight counts on the start date.
- No default hours. Back-up reminder after more than 14 days.
- Raise `VERSIE` in `sw.js` whenever a shipped file changes.
- Use a `<dialog>` helper for confirmations, never `window.confirm`.

## Review Focus

- Filling a day that already has a record: asks first, then replaces; never two records for one date.
- A worked day of 0 hours, over 24 hours, or with a negative pause is refused with a clear message.
- Month edges: a month that starts on a Sunday or ends on a Monday, December and January across ISO week 52/53/1, and February in a leap year.
- Switching a day from worked to not worked (and back) leaves no stale hours or reason behind.
- Deleting a day removes it from totals and CSV.
- Restoring a broken or foreign JSON file is refused and changes nothing; the old data is kept under a safety key first.
- Days in the future are allowed and counted in totals only if they have hours (a planned holiday is not "worked").
- Month navigation far into the past or future still renders.

---

## File Structure

- Create `single-hours-check/js/logic.js`: dates, hours, records, month grid, summaries, CSV, validation.
- Create `single-hours-check/js/app.js`: storage, tabs Invullen / Maand / Bestanden, dialogs, backup.
- Create `single-hours-check/index.html`, `css/app.css`.
- Create `single-hours-check/sw.js`, `manifest.webmanifest`, `icons/` (svg + png), `netlify.toml`, `dev-server.py`, `CLAUDE.md`.
- Test: `single-hours-check/test/test.js`.

---

### Task 1: Rules in logic.js

**Files:**
- Create: `single-hours-check/js/logic.js`
- Test: `single-hours-check/test/test.js`

**Interfaces:**
- Produces (on `module.exports` and `window.Logic`), `Rec = {date, kind: 'gewerkt'|'vrij'|'ziek'|'vakantie'|'feestdag', mode?: 'times'|'hours', start?, end?, breakMin?, hours?, note}`, `Data = {version, days: {[date]: Rec}, lastBackup, firstUse, prefs: {start, end, breakMin}}`:
  - `KINDS: Array<{id, label}>` (gewerkt not included; reasons only: vrij, ziek, vakantie, feestdag)
  - `toISO(d: Date): string`, `parseISO(s): Date`, `addDays(iso, n): string`, `todayISO(): string`
  - `langeDatum(iso): string` ("donderdag 12 november")
  - `isoWeek(iso): number`, `weekStart(iso): string`
  - `cleanBreak(x): number`, `hoursFromTimes(start, end, breakMin): number`, `fmtHours(h: number): string`, `parseHours(text): number | null`
  - `recHours(rec: Rec): number` (0 for non-worked)
  - `validateRec(rec): {ok: boolean, error?: string}` (worked needs hours > 0 and at most 24; times need start and end; reasons need a known kind)
  - `setDay(data, rec): 'new' | 'replaced'`, `removeDay(data, date): boolean`
  - `monthGrid(yyyyMm: string): Array<Array<string | null>>` (weeks of 7 cells, Monday first, null outside the month)
  - `monthSummary(data, yyyyMm): {hours: number, daysWorked: number, off: {vrij, ziek, vakantie, feestdag: number}, weeks: Array<{week: number, hours: number, partial: boolean, from: string, to: string}>}`
  - `csvForMonth(data, yyyyMm): string`
  - `monthLabel(yyyyMm): string` ("november 2026"), `shiftMonth(yyyyMm, n): string`
  - `upgradeData(d): Data`, `isValidData(d): boolean`

- [ ] **Step 1: Write failing tests** in `test/test.js` (names and assertions, with the spec's exact values):
  - hours: `hoursFromTimes('08:00','16:30',30) === 8`; `('22:00','06:00',30) === 7.5`; negative break `-60` counts as 0 (`('08:00','16:00',-60) === 8`); `cleanBreak('abc') === 0`; `fmtHours(7.5) === '7,5'`, `fmtHours(8) === '8'`; `parseHours('7,5') === 7.5`, `parseHours('x') === null`.
  - `validateRec`: worked with 0 hours not ok; with 25 hours not ok; with `hours: 7.5` ok; times with start 08:00 end 08:10 break 30 (0 hours) not ok; reason `'ziek'` ok; unknown kind not ok.
  - `setDay` returns `'new'` the first time and `'replaced'` the second time for the same date, and `Object.keys(data.days).length` stays 1; switching a worked record to `vakantie` leaves no `hours` or `start` on the stored record; `removeDay` returns true then false.
  - `monthGrid('2026-11')`: first row starts with `null` (1 Nov 2026 is a Sunday, so six nulls then `'2026-11-01'`), contains 30 dates, every row has 7 cells; `monthGrid('2024-02')` has 29 dates; a month ending on a Monday ends its last row with `'...-30'` or `'...-31'` followed by nulls.
  - `monthSummary` with: 9 Nov 8 h, 10 Nov 7,5 h, 11 Nov `vakantie`, 12 Nov `ziek`, 13 Nov `vrij`, 14 Nov `feestdag`, 1 Dec 6 h: for `'2026-11'` hours is 15,5, daysWorked 2, off `{vrij:1, ziek:1, vakantie:1, feestdag:1}`; the 1 Dec record is not counted. Weeks: week 46 has hours 15,5 and `partial === false`; the first week of November (week 44, 26 Oct to 1 Nov) has `partial === true` with `from === '2026-11-01'`.
  - December 2026 to January 2027: the week containing 1 Jan 2027 is ISO week 53 and is listed once in both months with `partial === true`.
  - `csvForMonth`: header line `Datum;Dag;Week;Soort;Uren;Begin;Eind;Pauze (min);Notitie`, a worked row `09-11-2026;maandag;46;Gewerkt;8;08:00;16:30;30;`, a reason row `11-11-2026;woensdag;46;Vakantie;;;;;`, a note with `"` and `;` is quoted correctly, ends with `Totaal uren;;;;15,5` style total row, starts without BOM (the BOM is added by the app).
  - `upgradeData` fills `firstUse`, `lastBackup: null`, `prefs`, `days: {}`; `isValidData({})` false, `isValidData({days: {}})` true, a record with a bad date key is dropped.
- [ ] **Step 2: Run `node single-hours-check/test/test.js`.** Expected: FAIL, `Cannot find module '../js/logic.js'`.
- [ ] **Step 3: Implement the interface above in `js/logic.js`** (UMD style, copy the date, ISO week, `cleanBreak`, `hoursFromTimes`, `fmtHours`, `parseHours` ideas from `../js/logic.js` but keep the file standalone).
- [ ] **Step 4: Run the tests.** Expected: `Alle tests zijn goed.`
- [ ] **Step 5: Commit** `git add single-hours-check && git commit -m "Mijn uren: rekenregels"`

---

### Task 2: App shell, screens and storage

**Files:**
- Create: `single-hours-check/index.html`, `css/app.css`, `js/app.js`

**Interfaces:**
- Consumes: everything from Task 1 on `window.Logic`.
- Produces: tabs `invullen`, `maand`, `bestanden`; `dialog(title, bodyHtml, buttons): Promise<{value, text, fields}>` and `confirmBox(title, text, okLabel, danger): Promise<boolean>` (same pattern as `../js/app.js`, resolve straight away, ignore a late `close` event while another dialog is open); storage key `mijn-uren-v1`, safety key `mijn-uren-v1-voor-terugzetten`.

- [ ] **Step 1: index.html and css.** Header bar, `#scherm`, toast, three tabs (Invullen, Maand, Bestanden) with simple svg icons, `<dialog id="dlg">`, scripts `js/logic.js` then `js/app.js`. Blue `#1B4F8F` header, same grown-up spacing as the Uren app; colours: worked blue, vakantie yellow, ziek red, vrij and feestdag grey.
- [ ] **Step 2: Invullen screen.** Date row with arrows and a hidden `type="date"` over the label (shows "vandaag" / "gisteren" / "morgen"); two big buttons Gewerkt and Niet gewerkt (`aria-pressed`). Gewerkt: Tijden / Alleen uren switch, begin, eind, pauze with chips 0, 15, 30, 45, 60, or hours field with chips 4, 6, 7,5, 8, live total. Niet gewerkt: four reason buttons. Notitie field. Save button. If the date already has a record: banner "Deze dag is al ingevuld: 8 uur" and the save button asks `confirmBox` before replacing. Messages: "Dit komt uit op 0 uur. Controleer de tijden.", "Meer dan 24 uur kan niet.", "Kies een reden." Save toast: "Opgeslagen: donderdag 12 november, 8 uur" or "Opgeslagen: ... Ziek". After saving, move to the next empty day? No: stay on the same date, show the saved state.
- [ ] **Step 3: Maand screen.** Month arrows with label and "Naar deze maand". Summary block (total hours, gewerkte dagen, then a line per reason that has days). Calendar grid with weekday header (ma t/m zo), each cell a button showing the day number and below it the hours or a short reason letter (`V` vrij, `Z` ziek, `Vk` vakantie, `F` feestdag); empty days plain, today outlined, future days dimmer. Below: weeks list with "Week 44 (deel): 3,5 uur" style lines. Tapping a day opens a dialog with the record, buttons Wijzig (go to Invullen on that date), Verwijder (confirm), Sluiten; an empty day offers Invullen.
- [ ] **Step 4: Bestanden screen.** Month picker with "Download deze maand voor Excel", "Back-up maken", "Back-up terugzetten" (JSON file input, refuse with "Dit is geen back-up van Mijn uren" when `isValidData` is false, confirm first, save the old data under the safety key), last back-up date, reminder banner after more than 14 days (only when there are records), install hint like in the Uren app (iPhone: Safari, Deel, Zet op beginscherm). Phones use the share sheet for files, computers use a download link.
- [ ] **Step 5: Verify in the browser** (preview server on `single-hours-check`, 375px): fill a week with two off days, one night shift, replace a day (asked first), delete a day, switch months, refuse 0 hours and a negative pause, download CSV text matches `csvForMonth`, restore a bad file is refused. Expected: totals on screen equal the Node test numbers, no console errors, no sideways scroll.
- [ ] **Step 6: Commit** `git add single-hours-check && git commit -m "Mijn uren: schermen en opslag"`

---

### Task 3: App packaging, docs, push

**Files:**
- Create: `single-hours-check/sw.js`, `manifest.webmanifest`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `netlify.toml`, `dev-server.py`, `CLAUDE.md`
- Modify: `.claude/launch.json` (add a `mijn-uren` entry on port 8124)

- [ ] **Step 1: Icons.** Generate the three PNGs with a small Python script (same approach as the Uren icon: a clock face), but a green background (`#1E7A46`) and a white check mark in the middle instead of clock hands, so the two apps are easy to tell apart; also an SVG.
- [ ] **Step 2: Manifest, service worker, netlify.toml, dev-server.py.** Name "Mijn uren", `theme_color` the app blue, `VERSIE = 'mijn-uren-v1'`, cache all shipped files, `sw.js` served with `Cache-Control: no-cache`. `dev-server.py` on port 8124 without caching and with correct JS types.
- [ ] **Step 3: CLAUDE.md in the folder:** structure, storage object, rules (one record per date, 0 and 24 hour limits, break cleaning, week partials), how to test, how to put it online.
- [ ] **Step 4: Verify offline and install:** service worker registered, caches the shipped files, app loads with the network off (`navigator.onLine` emulation or a reload after caching). Expected: loads, data intact.
- [ ] **Step 5: Run `node single-hours-check/test/test.js` and the existing `node test/test.js` and `node test/scene-model.test.js`.** Expected: all three pass (the Uren app is untouched).
- [ ] **Step 6: Commit and push** `git add -A && git commit -m "Mijn uren: pakket en documentatie" && git push -u origin <branch>`
