// Run with: node test/test.js
const assert = require('assert');
const L = require('../js/logic.js');

// hours
assert.strictEqual(L.hoursFromTimes('08:00', '16:30', 30), 8);
assert.strictEqual(L.hoursFromTimes('08:00', '15:30', 30), 7);
assert.strictEqual(L.hoursFromTimes('22:00', '06:00', 30), 7.5, 'over midnight');
assert.strictEqual(L.hoursFromTimes('08:00', '08:20', 30), 0, 'never negative');
assert.strictEqual(L.fmtHours(7.5), '7,5');
assert.strictEqual(L.fmtHours(8), '8');
assert.strictEqual(L.fmtHours(7.25), '7,25');
assert.strictEqual(L.parseHours('7,5'), 7.5);
assert.strictEqual(L.parseHours('abc'), null);
assert.strictEqual(L.parseHours('30'), null);

// weeks (ISO, monday first)
assert.strictEqual(L.weekStart('2026-11-12'), '2026-11-09'); // thursday -> monday
assert.strictEqual(L.weekStart('2026-11-15'), '2026-11-09'); // sunday -> monday before
assert.strictEqual(L.isoWeek('2026-11-12'), 46);
assert.strictEqual(L.isoWeek('2026-01-01'), 1);
assert.strictEqual(L.isoWeek('2027-01-01'), 53); // belongs to 2026 week 53
assert.strictEqual(L.weekLabel('2026-11-09'), 'Week 46 · 9 t/m 15 nov');
assert.strictEqual(L.weekLabel('2026-10-26'), 'Week 44 · 26 okt t/m 1 nov');
assert.strictEqual(L.langeDatum('2026-11-12'), 'donderdag 12 november');
assert.strictEqual(L.addDays('2026-02-28', 1), '2026-03-01');

// a week for two people
const data = {
  employees: [
    { id: 'j', name: 'Jan', active: true },
    { id: 'p', name: 'Piet', active: true },
    { id: 'o', name: 'Oud', active: false },
  ],
  entries: [
    { id: '1', empId: 'j', date: '2026-11-09', mode: 'times', start: '08:00', end: '16:30', breakMin: 30 }, // 8
    { id: '2', empId: 'j', date: '2026-11-10', mode: 'times', start: '08:00', end: '16:00', breakMin: 30 }, // 7.5
    { id: '3', empId: 'j', date: '2026-11-11', mode: 'hours', hours: 6.25 },
    { id: '4', empId: 'p', date: '2026-11-09', mode: 'hours', hours: 4 },
    { id: '5', empId: 'p', date: '2026-11-09', mode: 'hours', hours: 3.5, note: 'Klus "Bakker"; Deventer' }, // same day twice
    { id: '6', empId: 'p', date: '2026-11-15', mode: 'times', start: '22:00', end: '06:00', breakMin: 30 }, // 7.5 over midnight
    { id: '7', empId: 'j', date: '2026-11-16', mode: 'hours', hours: 8 }, // next week, must not count
  ],
};
const t = L.weekTable(data, '2026-11-09');
assert.strictEqual(t.rows.length, 2, 'inactive person without hours is hidden');
assert.strictEqual(t.rows[0].total, 21.75);
assert.strictEqual(t.rows[1].total, 15);
assert.strictEqual(t.grand, 36.75);
assert.strictEqual(t.dayTotals[0], 15.5); // monday: 8 + 4 + 3.5
assert.strictEqual(t.rows[1].days[0].count, 2);

// an inactive person with hours that week still shows
data.entries.push({ id: '8', empId: 'o', date: '2026-11-12', mode: 'hours', hours: 2 });
assert.strictEqual(L.weekTable(data, '2026-11-09').rows.length, 3);
data.entries.pop();

// CSV
const csv = L.csvFor(data, '2026-11-09', '2026-11-15');
const lines = csv.split('\r\n');
assert.strictEqual(lines[0], 'Medewerker;Datum;Dag;Week;Begin;Eind;Pauze (min);Uren;Notitie');
assert.ok(csv.includes('Jan;09-11-2026;maandag;46;08:00;16:30;30;8;'), 'times row');
assert.ok(csv.includes('Jan;11-11-2026;woensdag;46;;;;6,25;'), 'hours row with decimal comma');
assert.ok(csv.includes('"Klus ""Bakker""; Deventer"'), 'quotes and semicolons escaped');
assert.ok(csv.includes('Totaal iedereen;;;;;;;36,75;'));
assert.ok(!csv.includes('16-11-2026'), 'next week excluded');
assert.ok(!csv.includes('.'.repeat(0) + '7.5'), 'no decimal point');

// month
const m = L.monthRange('2026-02');
assert.strictEqual(m.to, '2026-02-28');
assert.strictEqual(m.label, 'februari 2026');

console.log('Alle tests zijn goed.');
