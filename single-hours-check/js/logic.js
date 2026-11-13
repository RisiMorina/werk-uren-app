/* Mijn uren: de rekenregels. Geen DOM, dus testbaar in Node.
   Data: { version, days: { 'YYYY-MM-DD': record }, lastBackup, firstUse, prefs }
   Record: { date, kind: 'gewerkt' | 'vrij' | 'ziek' | 'vakantie' | 'feestdag', note,
             mode: 'times' | 'hours', start, end, breakMin, hours }   (mode en uren alleen bij 'gewerkt') */
(function (root) {
  'use strict';

  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var KINDS = [
    { id: 'vrij', label: 'Vrij' },
    { id: 'ziek', label: 'Ziek' },
    { id: 'vakantie', label: 'Vakantie' },
    { id: 'feestdag', label: 'Feestdag' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- datums (altijd lokaal, nooit UTC) ----
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(iso, n) { var d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function todayISO() { return toISO(new Date()); }
  function validDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;
  }
  function dagNaam(iso) { return DAGEN[parseISO(iso).getDay()]; }
  function langeDatum(iso) { var d = parseISO(iso); return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()]; }
  function nlDatum(iso) { return iso.split('-').reverse().join('-'); }

  function weekStart(iso) {
    var d = parseISO(iso);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toISO(d);
  }
  function isoWeek(iso) {
    var d = parseISO(iso);
    d.setHours(12);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  }
  function monthLabel(ym) { var p = ym.split('-'); return MAANDEN[+p[1] - 1] + ' ' + p[0]; }
  function shiftMonth(ym, n) {
    var p = ym.split('-'), total = +p[0] * 12 + (+p[1] - 1) + n;
    return Math.floor(total / 12) + '-' + pad(total % 12 + 1);
  }
  function monthBounds(ym) {
    var p = ym.split('-'), y = +p[0], m = +p[1];
    return { first: ym + '-01', last: ym + '-' + pad(new Date(y, m, 0).getDate()), days: new Date(y, m, 0).getDate() };
  }

  // ---- uren ----
  // Een pauze is hele minuten en nooit negatief (een getypte -60 zou een uur erbij geven).
  function cleanBreak(x) { var n = Math.round(Number(x)); return n > 0 ? n : 0; }
  function toMinutes(hhmm) { if (!hhmm) return null; var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  // Netto uren tussen begin en eind min pauze. Werkt over middernacht.
  function hoursFromTimes(start, end, breakMin) {
    var a = toMinutes(start), b = toMinutes(end);
    if (a === null || b === null || isNaN(a) || isNaN(b)) return 0;
    var diff = b - a;
    if (diff < 0) diff += 1440;
    var net = diff - cleanBreak(breakMin);
    if (net < 0) net = 0;
    return Math.round(net / 60 * 100) / 100;
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function fmtHours(h) { return String(round2(h)).replace('.', ','); }
  // "7,5" of "7.5" -> 7.5, onzin -> null (meer dan 24 komt door, de controle zegt dan waarom het niet kan)
  function parseHours(text) {
    if (text === null || text === undefined) return null;
    var t = String(text).trim().replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
  }

  // ---- een dag ----
  function isReason(kind) { return KINDS.some(function (k) { return k.id === kind; }); }
  function kindLabel(kind) {
    if (kind === 'gewerkt') return 'Gewerkt';
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === kind) return KINDS[i].label;
    return kind;
  }
  function recHours(rec) {
    if (!rec || rec.kind !== 'gewerkt') return 0;
    return rec.mode === 'times' ? hoursFromTimes(rec.start, rec.end, rec.breakMin) : (Number(rec.hours) || 0);
  }
  function bad(error) { return { ok: false, error: error }; }
  function validateRec(rec) {
    if (!rec || !validDate(rec.date)) return bad('Kies een datum.');
    if (rec.kind === 'gewerkt') {
      var h;
      if (rec.mode === 'times') {
        if (!rec.start || !rec.end) return bad('Vul begin en eind in.');
        h = hoursFromTimes(rec.start, rec.end, rec.breakMin);
      } else {
        if (rec.hours === '' || rec.hours === null || rec.hours === undefined || !isFinite(Number(rec.hours))) return bad('Vul het aantal uren in, bijvoorbeeld 7,5.');
        h = Number(rec.hours);
      }
      if (h > 24) return bad('Meer dan 24 uur kan niet.');
      if (h <= 0) return bad('Dit komt uit op 0 uur. Controleer de tijden.');
      return { ok: true };
    }
    if (!isReason(rec.kind)) return bad('Kies een reden.');
    return { ok: true };
  }
  // Bewaar alleen wat bij de soort hoort, zodat er nooit oude uren of tijden blijven hangen.
  function normalizeRec(rec) {
    var out = { date: rec.date, kind: rec.kind, note: String(rec.note || '').trim() };
    if (rec.kind === 'gewerkt') {
      if (rec.mode === 'times') { out.mode = 'times'; out.start = rec.start; out.end = rec.end; out.breakMin = cleanBreak(rec.breakMin); }
      else { out.mode = 'hours'; out.hours = round2(Number(rec.hours)); }
    }
    return out;
  }
  function setDay(data, rec) {
    var had = Object.prototype.hasOwnProperty.call(data.days, rec.date);
    data.days[rec.date] = normalizeRec(rec);
    return had ? 'replaced' : 'new';
  }
  function removeDay(data, date) {
    if (!Object.prototype.hasOwnProperty.call(data.days, date)) return false;
    delete data.days[date];
    return true;
  }

  // ---- maand ----
  // Weken van 7 vakjes, maandag eerst, null buiten de maand
  function monthGrid(ym) {
    var p = ym.split('-'), y = +p[0], m = +p[1];
    var lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    var cells = [], i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= monthBounds(ym).days; i++) cells.push(ym + '-' + pad(i));
    while (cells.length % 7) cells.push(null);
    var rows = [];
    for (i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }
  function monthSummary(data, ym) {
    var b = monthBounds(ym), out = { hours: 0, daysWorked: 0, off: { vrij: 0, ziek: 0, vakantie: 0, feestdag: 0 }, weeks: [] };
    Object.keys(data.days).forEach(function (date) {
      if (date < b.first || date > b.last) return;
      var r = data.days[date], h = recHours(r);
      if (r.kind === 'gewerkt') { if (h > 0) { out.hours += h; out.daysWorked++; } }
      else if (out.off[r.kind] !== undefined) out.off[r.kind]++;
    });
    out.hours = round2(out.hours);
    for (var ws = weekStart(b.first); ws <= b.last; ws = addDays(ws, 7)) {
      var we = addDays(ws, 6), from = ws < b.first ? b.first : ws, to = we > b.last ? b.last : we, sum = 0;
      Object.keys(data.days).forEach(function (date) { if (date >= from && date <= to) sum += recHours(data.days[date]); });
      out.weeks.push({ week: isoWeek(ws), hours: round2(sum), partial: from !== ws || to !== we, from: from, to: to });
    }
    return out;
  }

  // ---- CSV (Excel NL: puntkomma, decimale komma) ----
  function csvCell(v) {
    var s = String(v === null || v === undefined ? '' : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvForMonth(data, ym) {
    var b = monthBounds(ym), total = 0;
    var lines = [['Datum', 'Dag', 'Week', 'Soort', 'Uren', 'Begin', 'Eind', 'Pauze (min)', 'Notitie'].join(';')];
    Object.keys(data.days).sort().forEach(function (date) {
      if (date < b.first || date > b.last) return;
      var r = data.days[date], h = recHours(r), worked = r.kind === 'gewerkt', times = worked && r.mode === 'times';
      total += h;
      lines.push([
        nlDatum(date), dagNaam(date), isoWeek(date), kindLabel(r.kind),
        worked ? fmtHours(h) : '', times ? r.start : '', times ? r.end : '', times ? (r.breakMin || 0) : '', csvCell(r.note || '')
      ].map(function (c, i) { return i === 8 ? c : csvCell(c); }).join(';'));
    });
    lines.push('');
    lines.push(['Totaal uren', '', '', '', fmtHours(total), '', '', '', ''].join(';'));
    return lines.join('\r\n') + '\r\n';
  }

  // ---- data ----
  function isValidData(d) { return !!d && typeof d === 'object' && !!d.days && typeof d.days === 'object' && !Array.isArray(d.days); }
  function upgradeData(d) {
    var days = {};
    Object.keys(d.days || {}).forEach(function (key) {
      var r = d.days[key];
      if (!validDate(key) || !r || r.date !== key) return;
      if (r.kind !== 'gewerkt' && !isReason(r.kind)) return;
      if (!validateRec(r).ok) return;
      days[key] = normalizeRec(r);
    });
    d.days = days;
    d.version = d.version || 1;
    d.lastBackup = d.lastBackup || null;
    d.firstUse = d.firstUse || todayISO();
    d.prefs = d.prefs || { start: '08:00', end: '17:00', breakMin: 30 };
    return d;
  }

  var api = {
    KINDS: KINDS, toISO: toISO, parseISO: parseISO, addDays: addDays, todayISO: todayISO, validDate: validDate,
    dagNaam: dagNaam, langeDatum: langeDatum, weekStart: weekStart, isoWeek: isoWeek,
    monthLabel: monthLabel, shiftMonth: shiftMonth, monthBounds: monthBounds,
    cleanBreak: cleanBreak, hoursFromTimes: hoursFromTimes, fmtHours: fmtHours, parseHours: parseHours,
    kindLabel: kindLabel, recHours: recHours, validateRec: validateRec, setDay: setDay, removeDay: removeDay,
    monthGrid: monthGrid, monthSummary: monthSummary, csvForMonth: csvForMonth,
    isValidData: isValidData, upgradeData: upgradeData
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
