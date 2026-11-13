// Run with: node single-hours-check/test/test.js
const assert = require('assert');
const L = require('../js/logic.js');

const fresh = () => ({ version: 1, days: {}, lastBackup: null, firstUse: '2026-11-01', prefs: { start: '08:00', end: '17:00', breakMin: 30 } });

// ---- datums en weken ----
assert.strictEqual(L.langeDatum('2026-11-12'), 'donderdag 12 november');
assert.strictEqual(L.addDays('2026-02-28', 1), '2026-03-01');
assert.strictEqual(L.weekStart('2026-11-15'), '2026-11-09', 'sunday belongs to the week before');
assert.strictEqual(L.isoWeek('2026-11-12'), 46);
assert.strictEqual(L.isoWeek('2027-01-01'), 53, '1 Jan 2027 is in ISO week 53 of 2026');
assert.strictEqual(L.monthLabel('2026-11'), 'november 2026');
assert.strictEqual(L.shiftMonth('2026-12', 1), '2027-01');
assert.strictEqual(L.shiftMonth('2026-01', -1), '2025-12');
assert.strictEqual(L.shiftMonth('2026-11', -120), '2016-11');

// ---- uren ----
assert.strictEqual(L.hoursFromTimes('08:00', '16:30', 30), 8);
assert.strictEqual(L.hoursFromTimes('22:00', '06:00', 30), 7.5, 'over midnight');
assert.strictEqual(L.hoursFromTimes('08:00', '16:00', -60), 8, 'negative pause counts as none');
assert.strictEqual(L.hoursFromTimes('08:00', '08:10', 30), 0, 'never negative');
assert.strictEqual(L.cleanBreak('abc'), 0);
assert.strictEqual(L.cleanBreak(-5), 0);
assert.strictEqual(L.cleanBreak('45'), 45);
assert.strictEqual(L.fmtHours(7.5), '7,5');
assert.strictEqual(L.fmtHours(8), '8');
assert.strictEqual(L.fmtHours(7.25), '7,25');
assert.strictEqual(L.parseHours('7,5'), 7.5);
assert.strictEqual(L.parseHours('x'), null);
assert.strictEqual(L.parseHours(''), null);

// ---- een dag controleren ----
const worked = (o) => Object.assign({ date: '2026-11-09', kind: 'gewerkt', note: '' }, o);
assert.strictEqual(L.validateRec(worked({ mode: 'hours', hours: 0 })).ok, false, '0 hours refused');
assert.strictEqual(L.validateRec(worked({ mode: 'hours', hours: 25 })).ok, false, 'more than 24 refused');
assert.strictEqual(L.validateRec(worked({ mode: 'hours', hours: 25 })).error, 'Meer dan 24 uur kan niet.');
assert.strictEqual(L.validateRec(worked({ mode: 'hours', hours: 7.5 })).ok, true);
assert.strictEqual(L.validateRec(worked({ mode: 'hours', hours: 24 })).ok, true, 'exactly 24 is allowed');
const tenMin = L.validateRec(worked({ mode: 'times', start: '08:00', end: '08:10', breakMin: 30 }));
assert.strictEqual(tenMin.ok, false);
assert.strictEqual(tenMin.error, 'Dit komt uit op 0 uur. Controleer de tijden.');
assert.strictEqual(L.validateRec(worked({ mode: 'times', start: '', end: '16:00', breakMin: 30 })).ok, false, 'times need a start');
assert.strictEqual(L.validateRec(worked({ mode: 'times', start: '08:00', end: '16:00', breakMin: -60 })).ok, true);
assert.strictEqual(L.validateRec({ date: '2026-11-11', kind: 'ziek', note: '' }).ok, true);
assert.strictEqual(L.validateRec({ date: '2026-11-11', kind: 'onbekend', note: '' }).ok, false);
assert.strictEqual(L.validateRec({ date: '2026-11-11', kind: 'onbekend', note: '' }).error, 'Kies een reden.');
assert.strictEqual(L.validateRec({ kind: 'ziek', note: '' }).ok, false, 'a date is needed');
assert.deepStrictEqual(L.KINDS.map((k) => k.label), ['Vrij', 'Ziek', 'Vakantie', 'Feestdag']);

// ---- opslaan, vervangen, verwijderen ----
{
  const d = fresh();
  assert.strictEqual(L.setDay(d, worked({ mode: 'hours', hours: 8 })), 'new');
  assert.strictEqual(L.setDay(d, worked({ mode: 'times', start: '08:00', end: '16:30', breakMin: 30 })), 'replaced');
  assert.strictEqual(Object.keys(d.days).length, 1, 'one record per date');
  assert.strictEqual(L.recHours(d.days['2026-11-09']), 8);
  L.setDay(d, { date: '2026-11-09', kind: 'vakantie', mode: 'hours', hours: 8, start: '08:00', end: '16:00', breakMin: 30, note: 'strand' });
  const r = d.days['2026-11-09'];
  assert.deepStrictEqual(Object.keys(r).sort(), ['date', 'kind', 'note'], 'no stale hours or times after switching to a reason');
  assert.strictEqual(L.recHours(r), 0);
  L.setDay(d, worked({ mode: 'hours', hours: 6, note: 'x' }));
  assert.deepStrictEqual(Object.keys(d.days['2026-11-09']).sort(), ['date', 'hours', 'kind', 'mode', 'note'], 'no stale reason after switching to worked');
  assert.strictEqual(L.removeDay(d, '2026-11-09'), true);
  assert.strictEqual(L.removeDay(d, '2026-11-09'), false);
  assert.strictEqual(Object.keys(d.days).length, 0);
}

// ---- maandkalender ----
{
  const g = L.monthGrid('2026-11');
  assert.ok(g.every((row) => row.length === 7), 'every row has 7 cells');
  assert.deepStrictEqual(g[0], [null, null, null, null, null, null, '2026-11-01'], '1 Nov 2026 is a Sunday');
  assert.strictEqual(g.flat().filter(Boolean).length, 30);
  assert.deepStrictEqual(g[g.length - 1], ['2026-11-30', null, null, null, null, null, null], 'month that ends on a Monday');
  assert.strictEqual(L.monthGrid('2024-02').flat().filter(Boolean).length, 29, 'leap year');
  assert.strictEqual(L.monthGrid('2026-02').flat().filter(Boolean).length, 28);
  assert.strictEqual(L.monthGrid('2300-01').flat().filter(Boolean).length, 31, 'far future still works');
}

// ---- samenvatting per maand ----
{
  const d = fresh();
  L.setDay(d, worked({ date: '2026-11-09', mode: 'times', start: '08:00', end: '16:30', breakMin: 30 }));
  L.setDay(d, worked({ date: '2026-11-10', mode: 'hours', hours: 7.5 }));
  ['vakantie', 'ziek', 'vrij', 'feestdag'].forEach((k, i) => L.setDay(d, { date: '2026-11-' + (11 + i), kind: k, note: '' }));
  L.setDay(d, worked({ date: '2026-12-01', mode: 'hours', hours: 6 }));
  const s = L.monthSummary(d, '2026-11');
  assert.strictEqual(s.hours, 15.5);
  assert.strictEqual(s.daysWorked, 2);
  assert.deepStrictEqual(s.off, { vrij: 1, ziek: 1, vakantie: 1, feestdag: 1 });
  const w46 = s.weeks.find((w) => w.week === 46);
  assert.strictEqual(w46.hours, 15.5);
  assert.strictEqual(w46.partial, false);
  const w44 = s.weeks.find((w) => w.week === 44);
  assert.strictEqual(w44.partial, true);
  assert.strictEqual(w44.from, '2026-11-01');
  assert.strictEqual(w44.hours, 0);
  const w49 = s.weeks.find((w) => w.week === 49);
  assert.strictEqual(w49.partial, true, '30 Nov to 6 Dec is split over two months');
  assert.strictEqual(w49.to, '2026-11-30');
  assert.strictEqual(w49.hours, 0, '1 Dec is not counted in November');
  assert.strictEqual(L.monthSummary(d, '2026-12').hours, 6);
  assert.strictEqual(L.monthSummary(d, '2026-12').weeks.find((w) => w.week === 49).hours, 6, '1 Dec counts in December');

  // jaarwissel: week 53 komt in december en in januari voor
  const dec = L.monthSummary(fresh(), '2026-12').weeks;
  const jan = L.monthSummary(fresh(), '2027-01').weeks;
  assert.strictEqual(dec.filter((w) => w.week === 53).length, 1);
  assert.strictEqual(dec.find((w) => w.week === 53).partial, true);
  assert.strictEqual(dec.find((w) => w.week === 53).to, '2026-12-31');
  assert.strictEqual(jan[0].week, 53);
  assert.strictEqual(jan[0].from, '2027-01-01');
  assert.strictEqual(jan[0].partial, true);
  assert.strictEqual(jan[1].week, 1);

  // een geplande vakantie (toekomst) telt niet als gewerkt
  const f = fresh();
  L.setDay(f, { date: '2030-07-01', kind: 'vakantie', note: '' });
  const fs = L.monthSummary(f, '2030-07');
  assert.strictEqual(fs.hours, 0);
  assert.strictEqual(fs.daysWorked, 0);
  assert.strictEqual(fs.off.vakantie, 1);

  // ---- CSV ----
  L.setDay(d, { date: '2026-11-13', kind: 'vrij', note: 'Klus "A"; B' });
  const csv = L.csvForMonth(d, '2026-11');
  const lines = csv.split('\r\n');
  assert.strictEqual(lines[0], 'Datum;Dag;Week;Soort;Uren;Begin;Eind;Pauze (min);Notitie');
  assert.strictEqual(lines[1], '09-11-2026;maandag;46;Gewerkt;8;08:00;16:30;30;');
  assert.strictEqual(lines[2], '10-11-2026;dinsdag;46;Gewerkt;7,5;;;;');
  assert.strictEqual(lines[3], '11-11-2026;woensdag;46;Vakantie;;;;;');
  assert.ok(csv.includes('13-11-2026;vrijdag;46;Vrij;;;;;"Klus ""A""; B"'), 'quotes and semicolons escaped');
  assert.ok(csv.includes('Totaal uren;;;;15,5;;;;'));
  assert.ok(!csv.includes('01-12-2026'), 'December is not in the November file');
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(!csv.includes('15.5'), 'decimal comma only');
  assert.strictEqual(csv.charCodeAt(0), 'D'.charCodeAt(0), 'no BOM in the text, the app adds it');
}

// ---- oude of vreemde data ----
{
  assert.strictEqual(L.isValidData(null), false);
  assert.strictEqual(L.isValidData({}), false);
  assert.strictEqual(L.isValidData({ days: [] }), false);
  assert.strictEqual(L.isValidData({ days: {} }), true);
  const up = L.upgradeData({ days: {
    '2026-11-09': { date: '2026-11-09', kind: 'gewerkt', mode: 'hours', hours: 8, note: '' },
    kapot: { kind: 'ziek' },
    '2026-11-10': { date: '2026-11-10', kind: 'onbekend', note: '' },
    '2026-11-11': { date: '2026-11-12', kind: 'ziek', note: '' },
  } });
  assert.deepStrictEqual(Object.keys(up.days), ['2026-11-09'], 'bad keys, unknown kinds and mismatched dates are dropped');
  assert.strictEqual(up.lastBackup, null);
  assert.ok(up.firstUse && up.prefs && up.prefs.breakMin === 30);
}

console.log('Alle tests zijn goed.');
