/* Pure logic: dates, hours, weeks, CSV. No DOM here, so it can be tested in Node. */
(function (root) {
  'use strict';

  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var DAGEN_KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- dates (always local, never UTC) ----
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function todayISO() { return toISO(new Date()); }

  function dagNaam(iso) { return DAGEN[parseISO(iso).getDay()]; }
  function langeDatum(iso) {
    var d = parseISO(iso);
    return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()];
  }
  function korteDatum(iso) {
    var d = parseISO(iso);
    return d.getDate() + ' ' + MAANDEN_KORT[d.getMonth()];
  }

  // Monday of the week that contains iso
  function weekStart(iso) {
    var d = parseISO(iso);
    var dow = (d.getDay() + 6) % 7; // monday = 0
    d.setDate(d.getDate() - dow);
    return toISO(d);
  }
  // ISO 8601 week number
  function isoWeek(iso) {
    var d = parseISO(iso);
    d.setHours(12);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // thursday of this week
    var week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }
  function weekDays(startIso) {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(startIso, i));
    return out;
  }
  function weekLabel(startIso) {
    var end = addDays(startIso, 6);
    var s = parseISO(startIso), e = parseISO(end);
    var left = s.getMonth() === e.getMonth() ? String(s.getDate()) : s.getDate() + ' ' + MAANDEN_KORT[s.getMonth()];
    return 'Week ' + isoWeek(startIso) + ' · ' + left + ' t/m ' + e.getDate() + ' ' + MAANDEN_KORT[e.getMonth()];
  }

  // ---- time and hours ----
  function toMinutes(hhmm) {
    if (!hhmm) return null;
    var p = hhmm.split(':');
    return (+p[0]) * 60 + (+p[1]);
  }
  // Net hours between start and end minus break. Works over midnight.
  function hoursFromTimes(start, end, breakMin) {
    var a = toMinutes(start), b = toMinutes(end);
    if (a === null || b === null || isNaN(a) || isNaN(b)) return 0;
    var diff = b - a;
    if (diff < 0) diff += 1440;
    var net = diff - (Number(breakMin) || 0);
    if (net < 0) net = 0;
    return Math.round(net / 60 * 100) / 100;
  }
  function entryHours(e) {
    if (e.mode === 'hours') return Number(e.hours) || 0;
    return hoursFromTimes(e.start, e.end, e.breakMin);
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  // 7.5 -> "7,5"   8 -> "8"   7.25 -> "7,25"
  function fmtHours(h) {
    var r = round2(h);
    return String(r).replace('.', ',');
  }
  // "7,5" or "7.5" -> 7.5, bad input -> null
  function parseHours(text) {
    if (text === null || text === undefined) return null;
    var t = String(text).trim().replace(',', '.');
    if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
    var n = parseFloat(t);
    return n > 24 ? null : n;
  }

  // ---- sums ----
  function sumHours(entries) {
    var t = 0;
    for (var i = 0; i < entries.length; i++) t += entryHours(entries[i]);
    return round2(t);
  }
  function entriesFor(entries, empId, iso) {
    return entries.filter(function (e) { return e.empId === empId && e.date === iso; });
  }

  // Week table: rows per employee that is active OR has hours that week.
  function weekTable(data, startIso) {
    var days = weekDays(startIso);
    var first = days[0], last = days[6];
    var inWeek = data.entries.filter(function (e) { return e.date >= first && e.date <= last; });
    var rows = [];
    data.employees.forEach(function (emp) {
      var mine = inWeek.filter(function (e) { return e.empId === emp.id; });
      if (!emp.active && mine.length === 0) return;
      var perDay = days.map(function (d) {
        var list = mine.filter(function (e) { return e.date === d; });
        return { date: d, hours: sumHours(list), count: list.length };
      });
      rows.push({ emp: emp, days: perDay, total: sumHours(mine) });
    });
    var dayTotals = days.map(function (d, i) {
      return round2(rows.reduce(function (s, r) { return s + r.days[i].hours; }, 0));
    });
    var grand = round2(rows.reduce(function (s, r) { return s + r.total; }, 0));
    return { days: days, rows: rows, dayTotals: dayTotals, grand: grand };
  }

  // ---- CSV (Excel NL: semicolon, decimal comma) ----
  function csvCell(v) {
    var s = String(v === null || v === undefined ? '' : v);
    if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvFor(data, fromIso, toIso2) {
    var nameOf = {};
    data.employees.forEach(function (e) { nameOf[e.id] = e.name; });
    var list = data.entries.filter(function (e) { return e.date >= fromIso && e.date <= toIso2; });
    list.sort(function (a, b) {
      var an = nameOf[a.empId] || '', bn = nameOf[b.empId] || '';
      return a.date < b.date ? -1 : a.date > b.date ? 1 : an < bn ? -1 : an > bn ? 1 : 0;
    });
    var lines = [['Medewerker', 'Datum', 'Dag', 'Week', 'Begin', 'Eind', 'Pauze (min)', 'Uren', 'Notitie'].join(';')];
    list.forEach(function (e) {
      var times = e.mode === 'hours';
      lines.push([
        csvCell(nameOf[e.empId] || '(verwijderd)'),
        csvCell(e.date.split('-').reverse().join('-')),
        csvCell(dagNaam(e.date)),
        csvCell(isoWeek(e.date)),
        csvCell(times ? '' : e.start),
        csvCell(times ? '' : e.end),
        csvCell(times ? '' : (e.breakMin || 0)),
        csvCell(fmtHours(entryHours(e))),
        csvCell(e.note || '')
      ].join(';'));
    });
    // totals per employee
    var totals = {};
    list.forEach(function (e) { totals[e.empId] = (totals[e.empId] || 0) + entryHours(e); });
    lines.push('');
    lines.push(['Totaal per medewerker', '', '', '', '', '', '', 'Uren', ''].join(';'));
    var all = 0;
    Object.keys(totals).sort(function (a, b) { return (nameOf[a] || '') < (nameOf[b] || '') ? -1 : 1; }).forEach(function (id) {
      all += totals[id];
      lines.push([csvCell(nameOf[id] || '(verwijderd)'), '', '', '', '', '', '', csvCell(fmtHours(totals[id])), ''].join(';'));
    });
    lines.push(['Totaal iedereen', '', '', '', '', '', '', csvCell(fmtHours(all)), ''].join(';'));
    return lines.join('\r\n') + '\r\n';
  }
  function monthRange(yyyyMm) {
    var p = yyyyMm.split('-');
    var y = +p[0], m = +p[1];
    var last = new Date(y, m, 0).getDate();
    return { from: y + '-' + pad(m) + '-01', to: y + '-' + pad(m) + '-' + pad(last), label: MAANDEN[m - 1] + ' ' + y };
  }

  // ---- beroepen en inklokken ----
  var TRADES = [
    { id: 'elektricien', label: 'Elektricien' },
    { id: 'vloerlegger', label: 'Vloerlegger' },
    { id: 'schilder', label: 'Schilder' },
    { id: 'loodgieter', label: 'Loodgieter' },
    { id: 'timmerman', label: 'Timmerman' },
    { id: 'overig', label: 'Overig' }
  ];

  function tradeLabel(id) {
    for (var i = 0; i < TRADES.length; i++) if (TRADES[i].id === id) return TRADES[i].label;
    return 'Overig';
  }
  // Old data and old back-ups have no trade and no clock: give them defaults.
  function upgradeData(d) {
    var ids = {};
    d.employees.forEach(function (e) {
      ids[e.id] = true;
      var known = TRADES.some(function (t) { return t.id === e.trade; });
      if (!known) e.trade = 'overig';
    });
    var clock = {};
    Object.keys(d.clock || {}).forEach(function (id) { if (ids[id]) clock[id] = d.clock[id]; });
    d.clock = clock;
    return d;
  }

  // "YYYY-MM-DDTHH:MM" in local time
  function nowStamp(d) {
    d = d || new Date();
    return toISO(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function stampDate(stamp) {
    var dp = stamp.slice(0, 10).split('-'), tp = stamp.slice(11, 16).split(':');
    return new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1]);
  }
  function stampMinutes(a, b) {
    return Math.round((stampDate(b) - stampDate(a)) / 60000);
  }
  function clockIn(data, empId, stamp) {
    data.clock = data.clock || {};
    if (data.clock[empId]) return false;
    data.clock[empId] = stamp;
    return true;
  }
  // What clocking out would save. Does not change data.
  function clockOutPlan(data, empId, endStamp, breakMin) {
    var startStamp = data.clock[empId];
    var diff = stampMinutes(startStamp, endStamp);
    var entry = {
      id: uid(), empId: empId, date: startStamp.slice(0, 10), mode: 'times',
      start: startStamp.slice(11, 16), end: endStamp.slice(11, 16),
      breakMin: Number(breakMin) || 0, note: ''
    };
    var blocked = diff < 0 || diff >= 1440;
    return {
      entry: entry,
      hours: blocked ? 0 : entryHours(entry),
      tooLong: diff > 16 * 60,
      blocked: blocked
    };
  }
  function clockOutCommit(data, empId, entry) {
    data.entries.push(entry);
    delete data.clock[empId];
  }
  function clockCancel(data, empId) {
    if (data.clock) delete data.clock[empId];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var api = {
    DAGEN_KORT: DAGEN_KORT, MAANDEN: MAANDEN,
    toISO: toISO, parseISO: parseISO, addDays: addDays, todayISO: todayISO,
    dagNaam: dagNaam, langeDatum: langeDatum, korteDatum: korteDatum,
    weekStart: weekStart, isoWeek: isoWeek, weekDays: weekDays, weekLabel: weekLabel,
    hoursFromTimes: hoursFromTimes, entryHours: entryHours, fmtHours: fmtHours, parseHours: parseHours,
    sumHours: sumHours, entriesFor: entriesFor, weekTable: weekTable,
    csvFor: csvFor, monthRange: monthRange, uid: uid,
    TRADES: TRADES, tradeLabel: tradeLabel, upgradeData: upgradeData, nowStamp: nowStamp, stampMinutes: stampMinutes,
    clockIn: clockIn, clockOutPlan: clockOutPlan, clockOutCommit: clockOutCommit, clockCancel: clockCancel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
