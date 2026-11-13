# Werkvloer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first tab "Werkvloer": an isometric block-style building site where clocked-in people walk and do their trade, everyone else sits on a bench, and only the father clocks people in and out by tapping them.

**Architecture:** Pure rules (clock state, trades, geometry, walking) live in Node-testable files (`js/logic.js`, `js/scene-model.js`). One canvas renderer (`js/scene.js`) draws everything from a single `kubus()` block helper and reads the model. `js/app.js` adds the tab, the person sheet and a list fallback, and stores the clock state in the existing `localStorage` object.

**Tech Stack:** Plain HTML, CSS, JavaScript, Canvas 2D. No libraries. Node for tests (`node test/test.js`, `node test/scene-model.test.js`).

**Spec:** `docs/superpowers/specs/2026-11-13-werkvloer-design.md`

## Global Constraints

- No framework, no Three.js, no new downloads. Everything offline through `sw.js`.
- All copy in Dutch, no em-dashes, no English words in the interface.
- Text at least 18px, buttons at least 48px high, tap zone on a figure at least 48 css px.
- Local time everywhere, never UTC. Stamp format `"YYYY-MM-DDTHH:MM"`.
- Beroepen, exactly: Elektricien, Vloerlegger, Schilder, Loodgieter, Timmerman, Overig. Existing people become Overig.
- Clock state: `data.clock = { [empId]: "YYYY-MM-DDTHH:MM" }`. Break on clock-out defaults to `data.prefs.breakMin` (30).
- Clocked in more than 16 hours: yellow warning and the end time must be adjusted before saving. 0 hours: nothing is saved, the clock-in is wiped after confirmation.
- `prefers-reduced-motion`: figures stand still on the bench or at their work spot, no walking, no moving tools.
- Animation loop runs only while the Werkvloer tab and the page are visible.
- Max 16 figures readable.
- Raise `VERSIE` in `sw.js` and add new files to `BESTANDEN` in every task that adds or changes a shipped file.
- Use the existing `dialog(title, bodyHtml, buttons)` helper for sheets. Never call `window.confirm`.

## Review Focus

- Clocking in someone who is already clocked in: nothing changes, no second timestamp.
- Clock-out that crosses midnight (in 22:00, out 06:00 next day): 8 hours minus break, date is the start date.
- Clock-out after 24 hours or more: cannot be saved until the end time is adjusted.
- Deactivating a person who is clocked in: blocked with the message "Klok eerst uit".
- Restoring an old back-up that has no `clock` and no `trade`: app loads, everyone is Overig, nobody clocked in.
- 0 or 1 people, and 16 people: no overlap of figures on the bench or at work spots, nothing crashes.
- Page hidden or other tab open: no animation frames keep running.
- Tab switch while the sheet is open and someone is clocked out elsewhere: sheet shows current state, no double save.

---

## File Structure

- Modify `js/logic.js`: `TRADES`, `nowStamp`, `clockIn`, `clockOutPlan`, `clockOutCommit`, `clockCancel`, `stampMinutes`.
- Create `js/scene-model.js`: pure geometry and walking. No DOM.
- Create `js/scene.js`: canvas drawing, animation loop, tap hit-testing.
- Modify `js/app.js`: normalize `clock` and `trade`, Mensen trade picker, Werkvloer tab, person sheet, list fallback.
- Modify `index.html`, `css/app.css`: fourth tab, canvas container, list.
- Modify `sw.js`, `CLAUDE.md`.
- Tests: `test/test.js` (extend), `test/scene-model.test.js` (new).

---

### Task 1: Clock rules and trades in logic.js

**Files:**
- Modify: `js/logic.js`
- Test: `test/test.js`

**Interfaces:**
- Produces:
  - `TRADES: Array<{id: string, label: string}>` with ids `elektricien, vloerlegger, schilder, loodgieter, timmerman, overig`.
  - `nowStamp(d?: Date): string`
  - `stampMinutes(a: string, b: string): number` (minutes from stamp a to stamp b, may be negative)
  - `clockIn(data, empId: string, stamp: string): boolean` (false and no change if already clocked in)
  - `clockOutPlan(data, empId, endStamp: string, breakMin: number): {entry: Entry, hours: number, tooLong: boolean, blocked: boolean}`; `tooLong` when more than 16 h; `blocked` when 24 h or more or negative; `entry` is `{id, empId, date: startDate, mode: 'times', start: 'HH:MM', end: 'HH:MM', breakMin, note: ''}`; no mutation.
  - `clockOutCommit(data, empId, entry): void` (pushes entry, deletes `data.clock[empId]`)
  - `clockCancel(data, empId): void`
  - `Entry` hours still come from the existing `entryHours`.

- [ ] **Step 1: Write failing tests** in `test/test.js`, names and assertions:
  - `clockIn` twice keeps the first stamp (`'2026-11-13T08:00'`), second call returns `false`.
  - `clockOutPlan` 08:00 to 16:30 break 30 gives `hours === 8`, `tooLong === false`, `entry.date === '2026-11-13'`.
  - 22:00 (13th) to 06:00 (14th) break 30 gives `hours === 7.5`, `entry.date === '2026-11-13'`.
  - 08:00 to 02:00 next day (18 h) gives `tooLong === true`, `blocked === false`.
  - 08:00 to 08:00 next day (24 h) gives `blocked === true`.
  - end before start gives `blocked === true`.
  - 08:00 to 08:10 break 30 gives `hours === 0`.
  - `clockOutCommit` removes the clock key and adds exactly one entry; `data.entries.length` grows by 1.
  - `TRADES.length === 6` and last label is `'Overig'`.
- [ ] **Step 2: Run `node test/test.js`.** Expected: FAIL, `L.clockIn is not a function`.
- [ ] **Step 3: Implement the functions above in `js/logic.js`**, export on the `api` object. `stampMinutes` builds local `Date`s from the stamp parts; hours use the existing `hoursFromTimes` on the HH:MM parts.
- [ ] **Step 4: Run `node test/test.js`.** Expected: `Alle tests zijn goed.`
- [ ] **Step 5: Commit** `git add js/logic.js test/test.js && git commit -m "Inkloksregels en beroepen"`

---

### Task 2: Beroep per medewerker and data upgrade in app.js

**Files:**
- Modify: `js/app.js` (`normalize`, `addEmployee`, `renameEmployee`, `renderMensen`, `toggleActive`)

**Interfaces:**
- Consumes: `Logic.TRADES`
- Produces: every employee has `trade: string` (default `'overig'`); `data.clock` always an object; `tradeLabel(id: string): string` in `app.js`.

- [ ] **Step 1: Upgrade data on load and restore.** In `normalize(d)` set `d.clock = d.clock || {}` and `trade = trade || 'overig'` for each employee. Drop clock keys whose employee does not exist.
- [ ] **Step 2: Trade picker.** `askName` becomes `askPerson(title, name, trade, okLabel): Promise<{name, trade} | null>`. Dialog body: name input plus six `chip` buttons (`aria-pressed`) for the trades. Add and rename use it. Mensen row shows `Naam` with small text `Beroep · N invoeren`.
- [ ] **Step 3: Block deactivating a clocked-in person.** In `toggleActive`, if `data.clock[id]` exists, show toast `'Klok eerst uit'` (kind `fout`) and return.
- [ ] **Step 4: Verify in the browser** (`uren` preview): add "Kees" as Vloerlegger, reload, still Vloerlegger; load an old backup file without `trade`, everyone shows Overig. Expected: no console errors.
- [ ] **Step 5: Commit** `git add js/app.js && git commit -m "Beroep per medewerker"`

---

### Task 3: Scene model (geometry, spots, walking)

**Files:**
- Create: `js/scene-model.js`
- Test: `test/scene-model.test.js`

**Interfaces:**
- Produces (all on `module.exports` and `window.SceneModel`):
  - `iso(x: number, y: number, z: number): {sx: number, sy: number}` where world x runs right-down, y runs left-down, z up; `TILE_W = 64`, `TILE_H = 32`, `iso = (x,y,z) => ({sx: (x - y) * TILE_W / 2, sy: (x + y) * TILE_H / 2 - z})`.
  - `WORLD: {building: {x0, y0, x1, y1}, bench: {x0, y0, x1, y1}}` (building 8 x 6 tiles, bench 4 x 1 tiles to its right).
  - `workSpot(trade: string, indexInTrade: number): {x: number, y: number, face: number}` fixed per trade, with each next person of the same trade offset by 1 tile.
  - `benchSeat(i: number): {x: number, y: number}` for i 0 to 15 (bench has 8 seats, next 8 in a second row).
  - `makeFigure(emp, clockedIn: boolean): Figure` with `{id, trade, x, y, state: 'bench'|'toWork'|'working'|'toBench', target, color}`; starts at seat or spot without walking.
  - `setClocked(fig, clockedIn, target)`: sets `state` to `toWork` or `toBench` and the target.
  - `update(fig, dtSeconds: number, speed = 1.2)`: walks straight toward target at `speed` tiles per second, never overshoots, switches to `working` or `bench` on arrival.
  - `helmColor(id: string): string`: stable HSL string from the id.

- [ ] **Step 1: Write failing tests.** Assertions: `iso(0,0,0)` is `{sx:0, sy:0}`; `iso(1,0,0).sx === 32` and `.sy === 16`; 16 `benchSeat` results are all different; two Elektricien indexes 0 and 1 give different spots; six trades give six different spots for index 0; `update` with `dt = 100` lands exactly on target (no overshoot) and state becomes `working`; walking 1 tile at speed 1.2 for 0.5 s leaves it still `toWork`; `helmColor('a') === helmColor('a')`.
- [ ] **Step 2: Run `node test/scene-model.test.js`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `js/scene-model.js`.** UMD style like `logic.js`. Place spots inside the building footprint: elektricien at the back wall, vloerlegger on the left half floor, schilder at the right wall, loodgieter near the front pipes, timmerman at the frame, overig walks between two points handled in the renderer (spot is the pile of boards).
- [ ] **Step 4: Run `node test/scene-model.test.js`.** Expected: `Alle scene-tests zijn goed.`
- [ ] **Step 5: Commit** `git add js/scene-model.js test/scene-model.test.js && git commit -m "Scene-model: isometrie, werkplekken, lopen"`

---

### Task 4: Canvas renderer

**Files:**
- Create: `js/scene.js`

**Interfaces:**
- Consumes: `SceneModel.*`, `Logic.TRADES`
- Produces: `window.Scene = { mount(canvas: HTMLCanvasElement, onTap: (empId: string) => void): void, setPeople(list: Array<{id, name, trade, clockedIn: boolean}>): void, start(): void, stop(): void }`. `setPeople` diffs against the current figures: a changed `clockedIn` calls `setClocked`; new people are created in place; removed people are dropped.

- [ ] **Step 1: `kubus(ctx, x, y, z, w, d, h, color)`** draws a block with a light top and two darker sides using `iso`. All shapes in the scene use it.
- [ ] **Step 2: Draw the world** back to front (sort by `x + y`): ground, half-finished building (floor half tiled, two walls, one open side, frame posts, pipes, wall panel), bench with seats. Palette: app blue and yellow plus brick red, concrete, wood.
- [ ] **Step 3: Draw figures** as head cube, body box, swinging arm and leg boxes, helmet in `helmColor`, body colour per trade, name in 11px text above. Per-trade work motion while `working`: elektricien arm up and down at the panel, vloerlegger kneeling with a tile, schilder roller sweep, loodgieter wrench turn, timmerman hammer, overig carrying a board between two points.
- [ ] **Step 4: Layout and loop.** Fit the whole scene into the canvas (scale to width, centre). Size with `devicePixelRatio`. `requestAnimationFrame` loop with `dt` capped at 0.1 s. `start()` and `stop()` start and cancel it; `visibilitychange` stops when hidden. With `matchMedia('(prefers-reduced-motion: reduce)')`: draw once per change, no walking, figures placed directly, no tool motion.
- [ ] **Step 5: Tap.** `pointerup` converts to canvas coordinates, finds the nearest figure within 48 css px of its body centre, calls `onTap(id)`. No figure close enough does nothing.
- [ ] **Step 6: Verify visually.** Serve with `uren` preview, mount with 5 fake people (3 clocked in), screenshot at 375px and 1000px width. Expected: all six trades readable, no overlaps, nothing outside the canvas. Check 16 people too.
- [ ] **Step 7: Commit** `git add js/scene.js && git commit -m "Scene-tekenaar met blokjes-poppetjes"`

---

### Task 5: Werkvloer tab, person sheet, list fallback

**Files:**
- Modify: `index.html`, `css/app.css`, `js/app.js`, `sw.js`

**Interfaces:**
- Consumes: `Scene.mount/setPeople/start/stop`, `Logic.clockIn/clockOutPlan/clockOutCommit/clockCancel/nowStamp/stampMinutes`
- Produces: tab id `werkvloer` (first tab and default), `renderWerkvloer()`, `openPersonSheet(empId: string): Promise<void>`.

- [ ] **Step 1: Tab and screen.** Add the fourth tab "Werkvloer" first in `index.html` (icon: simple building outline, 28px). `go('werkvloer')` renders a thin label `Op de werkvloer: N van M` (M counts active people), the canvas filling the rest of the first screen height (`calc(100svh - header - tabs - label)`), then below it a `Lijst` section with the same people and a button each (`Inklokken` or `Uitklokken`, 52px high). Active people only, plus anyone currently clocked in. Empty state when there are no people: button "Voeg je eerste medewerker toe". `start()` on entering the tab, `stop()` on leaving. Start the app on `werkvloer`.
- [ ] **Step 2: Person sheet.** Tap on a figure or a list button opens `dialog` with: name, trade, and one of two bodies. Not clocked in: `Inklokken` (now) and a `datetime-local` field "Ingeklokt om" prefilled with now, so a forgotten clock-in can be set. Clocked in: text `Ingeklokt sinds <dag> <HH:MM>`, `datetime-local` for start and for end (default now), a pauze number (default `prefs.breakMin`), live total `X uur`, buttons `Uitklokken en opslaan`, `Annuleren inklokken` (with confirm, nothing saved). Yellow warning when `tooLong`; the save button is disabled while `blocked`, with the text `Controleer de eindtijd`. At 0 hours show the confirm `Dit is 0 uur. Inklokken wissen?`.
- [ ] **Step 3: Save paths.** Inklokken calls `clockIn`, `save()`, `Scene.setPeople`, toast `<naam> ingeklokt`. Uitklokken calls `clockOutCommit`, `save()`, updates the scene (figure walks to the bench), toast `Opgeslagen: <naam>, 7,5 uur`, and updates `data.prefs.breakMin`. The sheet re-reads `data.clock` on open so a stale tap never double saves.
- [ ] **Step 4: Offline and styles.** Add `js/scene-model.js` and `js/scene.js` to `BESTANDEN` and `index.html` script tags (in that order, before `app.js`), raise `VERSIE`. Four tabs fit at 375px.
- [ ] **Step 5: Verify in the browser** at 375px: add 3 people with different trades, tap the bench figure, clock in, watch the walk, tap the working figure, clock out, check the entry appears in Week with the right hours and the CSV; test midnight and a forgotten 20-hour clock-in; check reduced motion (DevTools emulation); check the tab hidden case stops the loop. Expected: all flows work, no console errors.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Werkvloer-tab met inklokken en uitklokken"`

---

### Task 6: Docs, full check, push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`:** new files and their roles, `clock` and `trade` in the storage block, the rules (16-hour check, break default, reduced motion, loop only when visible), and the open point that clock state is per device.
- [ ] **Step 2: Run both test files.** Expected: both print their success line.
- [ ] **Step 3: Final screenshots** at 375px, 768px and desktop of Werkvloer, and check no sideways scroll at 375px.
- [ ] **Step 4: Commit and push** `git add -A && git commit -m "Werkvloer: documentatie" && git push -u origin werkvloer-scene`
