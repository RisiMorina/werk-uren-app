/* Uren: schermen, opslag en knoppen. De rekenregels staan in logic.js. */
(function () {
  'use strict';
  var L = window.Logic;
  var KEY = 'uren-data-v1';
  var $ = function (s, el) { return (el || document).querySelector(s); };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- opslag ----------
  function emptyData() {
    return { version: 1, employees: [], entries: [], clock: {}, lastBackup: null, firstUse: L.todayISO(), prefs: { start: '08:00', end: '17:00', breakMin: 30 } };
  }
  function valid(d) { return d && Array.isArray(d.employees) && Array.isArray(d.entries); }
  function normalize(d) {
    d.firstUse = d.firstUse || L.todayISO();
    d.lastBackup = d.lastBackup || null;
    d.prefs = d.prefs || { start: '08:00', end: '17:00', breakMin: 30 };
    return L.upgradeData(d);
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); if (valid(d)) return normalize(d); }
    } catch (e) { /* kapot of geen toegang: begin leeg */ }
    return emptyData();
  }
  var data = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { toast('Opslaan lukt niet. Maak een back-up!', 'fout'); }
  }
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* niet erg */ } }

  // ---------- staat ----------
  var st = {
    tab: 'invullen',
    week: L.weekStart(L.todayISO()),
    month: L.todayISO().slice(0, 7),
    form: newForm()
  };
  function newForm() {
    var p = data.prefs;
    return { empId: null, date: L.todayISO(), mode: 'times', start: p.start, end: p.end, breakMin: p.breakMin, hours: '', note: '', editingId: null };
  }
  function empName(id) {
    for (var i = 0; i < data.employees.length; i++) if (data.employees[i].id === id) return data.employees[i].name;
    return '(verwijderd)';
  }
  function activeEmployees() { return data.employees.filter(function (e) { return e.active; }); }

  // ---------- kleine hulpen ----------
  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function dialog(title, body, buttons) {
    return new Promise(function (resolve) {
      var d = $('#dlg');
      d.innerHTML = '<h2>' + esc(title) + '</h2><div class="dlg-body">' + body + '</div><div class="dlg-knoppen">' +
        buttons.map(function (b) {
          return '<button class="knop ' + (b.cls || '') + '" data-val="' + esc(b.value) + '">' + esc(b.label) + '</button>';
        }).join('') + '</div>';
      var finished = false;
      function done(val) {
        if (finished) return;
        finished = true;
        var inp = d.querySelector('input.dlg-input');
        var text = inp ? inp.value : null;
        d.removeEventListener('click', onClick);
        d.removeEventListener('close', onClose);
        d.removeEventListener('keydown', onKey);
        if (d.open) d.close();
        var pick = d.querySelector('.chip[data-trade][aria-pressed="true"]');
        resolve({ value: val, text: text, trade: pick ? pick.getAttribute('data-trade') : null });
      }
      function onClick(e) { var b = e.target.closest('[data-val]'); if (b) done(b.getAttribute('data-val')); }
      // Alleen voor de Esc-toets. Het 'close'-signaal van een vorige dialog komt soms laat aan,
      // terwijl de volgende al open staat: dat negeren we.
      function onClose() { if (!d.open) done(null); }
      function onKey(e) { if (e.key === 'Enter' && e.target.matches('input.dlg-input')) { e.preventDefault(); done('ok'); } }
      d.addEventListener('click', onClick);
      d.addEventListener('close', onClose);
      d.addEventListener('keydown', onKey);
      d.showModal();
      var first = d.querySelector('input.dlg-input');
      if (first) { first.focus(); first.select(); }
    });
  }
  function confirmBox(title, text, okLabel, danger) {
    return dialog(title, '<p>' + esc(text) + '</p>', [
      { label: okLabel, value: 'ja', cls: 'primair' + (danger ? ' gevaar' : '') },
      { label: 'Nee, terug', value: 'nee' }
    ]).then(function (r) { return r.value === 'ja'; });
  }
  // Naam en beroep in een pop-up. Geeft {name, trade} of null.
  function askPerson(title, name, trade, okLabel) {
    var body = '<input type="text" class="dlg-input" maxlength="40" autocomplete="off" value="' + esc(name || '') + '" aria-label="Naam">' +
      '<p class="uitleg" style="margin:14px 0 0">Beroep</p><div class="chips">' +
      L.TRADES.map(function (t) {
        return '<button type="button" class="chip" data-action="beroep" data-trade="' + t.id + '" aria-pressed="' + (t.id === trade) + '">' + esc(t.label) + '</button>';
      }).join('') + '</div>';
    return dialog(title, body, [
      { label: okLabel, value: 'ok', cls: 'primair' },
      { label: 'Annuleren', value: 'nee' }
    ]).then(function (r) {
      if (r.value !== 'ok') return null;
      var n = (r.text || '').trim();
      return n ? { name: n, trade: r.trade || 'overig' } : null;
    });
  }

  function saveFile(name, mime, text, bom) {
    var blob = new Blob([bom ? '﻿' : '', text], { type: mime + ';charset=utf-8' });
    var file;
    try { file = new File([blob], name, { type: mime }); } catch (e) { file = null; }
    // Op een telefoon: deelmenu, daar kun je het opslaan of mailen.
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && window.matchMedia('(pointer: coarse)').matches) {
      return navigator.share({ files: [file], title: name }).then(function () { return true; }, function (err) {
        if (err && err.name === 'AbortError') return false;
        download(blob, name); return true;
      });
    }
    download(blob, name);
    return Promise.resolve(true);
  }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- tabs ----------
  var TITELS = { invullen: 'Uren invullen', week: 'Weekoverzicht', mensen: 'Mensen en bestanden' };
  function go(tab) {
    st.tab = tab;
    document.querySelectorAll('.tab').forEach(function (b) {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#titel').textContent = (tab === 'invullen' && st.form.editingId) ? 'Invoer wijzigen' : TITELS[tab];
    $('#scherm').className = 'scherm' + (tab === 'week' ? ' breed' : '');
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    renderBanner();
    if (st.tab === 'invullen') renderInvullen();
    else if (st.tab === 'week') renderWeek();
    else renderMensen();
  }

  // ---------- back-up herinnering ----------
  function backupDue() {
    if (!data.entries.length) return false;
    var ref = data.lastBackup || data.firstUse;
    var days = (L.parseISO(L.todayISO()) - L.parseISO(ref)) / 86400000;
    return days > 14;
  }
  function renderBanner() {
    var b = $('#banner');
    if (!backupDue()) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = '<span>' + (data.lastBackup ? 'De laatste back-up is al meer dan 14 dagen oud.' : 'Je hebt nog geen back-up gemaakt.') +
      '</span><button class="knop" data-action="backup">Back-up maken</button>';
  }

  // ---------- scherm: invullen ----------
  function formHours() {
    var f = st.form;
    if (f.mode === 'hours') { var h = L.parseHours(f.hours); return h === null ? 0 : h; }
    return L.hoursFromTimes(f.start, f.end, f.breakMin);
  }
  function renderInvullen() {
    var f = st.form;
    var emps = activeEmployees();
    var html = '';

    if (!emps.length) {
      $('#scherm').innerHTML = '<div class="blok leeg"><p>Er zijn nog geen medewerkers.</p>' +
        '<button class="knop primair groot" data-action="eerste-mens">Voeg je eerste medewerker toe</button></div>';
      return;
    }

    if (f.editingId) {
      html += '<div class="wijzig-balk"><span>Je wijzigt een invoer</span><button class="knop" data-action="annuleer-wijzig">Annuleren</button></div>';
    }

    html += '<section class="blok"><h2>Wie heeft gewerkt?</h2><div class="namen">' +
      emps.map(function (e) {
        return '<button class="naam" data-action="kies" data-id="' + esc(e.id) + '" aria-pressed="' + (f.empId === e.id) + '">' + esc(e.name) + '</button>';
      }).join('') + '</div></section>';

    var isVandaag = f.date === L.todayISO();
    html += '<section class="blok"><h2>Welke dag?</h2><div class="datumrij">' +
      '<button class="pijl" data-action="dag-min" aria-label="Een dag eerder">‹</button>' +
      '<label class="datum"><span id="datumtekst">' + datumHtml(f.date) + '</span><input type="date" id="f-date" value="' + esc(f.date) + '" aria-label="Kies een datum"></label>' +
      '<button class="pijl" data-action="dag-plus" aria-label="Een dag later">›</button></div>' +
      (isVandaag ? '' : '<div class="chips"><button class="chip" data-action="vandaag">Naar vandaag</button></div>') +
      '</section>';

    html += '<section class="blok"><h2>Hoeveel uur?</h2>' +
      '<div class="wissel" role="group" aria-label="Hoe vul je het in">' +
      '<button data-action="mode" data-mode="times" aria-pressed="' + (f.mode === 'times') + '">Tijden</button>' +
      '<button data-action="mode" data-mode="hours" aria-pressed="' + (f.mode === 'hours') + '">Alleen uren</button></div>';
    if (f.mode === 'times') {
      html += '<div class="velden">' +
        '<div class="veld"><label for="f-start">Begin</label><input type="time" id="f-start" value="' + esc(f.start) + '"></div>' +
        '<div class="veld"><label for="f-end">Eind</label><input type="time" id="f-end" value="' + esc(f.end) + '"></div>' +
        '<div class="veld vol"><label for="f-break">Pauze in minuten</label><input type="number" id="f-break" inputmode="numeric" min="0" max="600" step="5" value="' + esc(f.breakMin) + '">' +
        '<div class="chips">' + [0, 15, 30, 45, 60].map(function (m) {
          return '<button class="chip" data-action="pauze" data-min="' + m + '" aria-pressed="' + (Number(f.breakMin) === m) + '">' + m + '</button>';
        }).join('') + '</div></div></div>';
    } else {
      html += '<div class="veld"><label for="f-hours">Aantal uren</label><input type="text" id="f-hours" inputmode="decimal" autocomplete="off" placeholder="bijvoorbeeld 7,5" value="' + esc(f.hours) + '">' +
        '<div class="chips">' + ['4', '6', '7,5', '8'].map(function (h) {
          return '<button class="chip" data-action="uren" data-h="' + h + '" aria-pressed="' + (f.hours === h) + '">' + h + '</button>';
        }).join('') + '</div></div>';
    }
    html += '<div class="totaal"><span>Totaal</span><strong id="totaal">' + L.fmtHours(formHours()) + ' uur</strong></div></section>';

    html += '<section class="blok"><div class="veld"><label for="f-note">Notitie (mag leeg blijven)</label>' +
      '<input type="text" class="notitie" id="f-note" maxlength="120" autocomplete="off" placeholder="bijvoorbeeld klus of adres" value="' + esc(f.note) + '"></div></section>';

    html += '<div class="blok kaal"><button class="knop primair groot vol" data-action="opslaan">' + (f.editingId ? 'Wijziging opslaan' : 'Opslaan') + '</button>' +
      (f.editingId ? '' : '<div style="height:10px"></div><button class="knop vol" data-action="gisteren">Zelfde als gisteren</button>') + '</div>';

    // Wat staat er al voor deze dag
    var dayEntries = data.entries.filter(function (e) { return e.date === f.date; });
    if (dayEntries.length) {
      html += '<section class="blok"><h2>Al ingevuld op deze dag</h2><ul class="vandaag-lijst">' +
        dayEntries.map(function (e) {
          return '<li><span><b>' + esc(empName(e.empId)) + '</b> ' + L.fmtHours(L.entryHours(e)) + ' uur' +
            (e.note ? '<br><span class="klein">' + esc(e.note) + '</span>' : '') + '</span>' +
            '<button class="link" data-action="wijzig" data-id="' + esc(e.id) + '">Wijzig</button></li>';
        }).join('') + '</ul></section>';
    }
    $('#scherm').innerHTML = html;
  }
  function datumHtml(iso) {
    var t = L.todayISO();
    var extra = iso === t ? 'vandaag' : iso === L.addDays(t, -1) ? 'gisteren' : iso === L.addDays(t, 1) ? 'morgen' : '';
    return esc(L.langeDatum(iso)) + (extra ? '<small>' + extra + '</small>' : '');
  }
  function updatePreview() { var t = $('#totaal'); if (t) t.textContent = L.fmtHours(formHours()) + ' uur'; }

  function saveEntry() {
    var f = st.form;
    if (!f.empId) { toast('Kies eerst wie er heeft gewerkt.', 'fout'); return; }
    if (!f.date) { toast('Kies een datum.', 'fout'); return; }
    var entry = { id: f.editingId || L.uid(), empId: f.empId, date: f.date, mode: f.mode, note: (f.note || '').trim() };
    if (f.mode === 'times') {
      if (!f.start || !f.end) { toast('Vul begin en eind in.', 'fout'); return; }
      entry.start = f.start; entry.end = f.end; entry.breakMin = Number(f.breakMin) || 0;
    } else {
      var h = L.parseHours(f.hours);
      if (h === null) { toast('Vul het aantal uren in, bijvoorbeeld 7,5.', 'fout'); return; }
      entry.hours = h;
    }
    var hrs = L.entryHours(entry);
    if (hrs <= 0) { toast('Dit komt uit op 0 uur. Controleer de tijden.', 'fout'); return; }

    function commit() {
      if (f.editingId) {
        data.entries = data.entries.map(function (e) { return e.id === f.editingId ? entry : e; });
      } else {
        data.entries.push(entry);
      }
      if (f.mode === 'times') data.prefs = { start: f.start, end: f.end, breakMin: Number(f.breakMin) || 0 };
      save();
      toast('Opgeslagen: ' + empName(entry.empId) + ', ' + L.fmtHours(hrs) + ' uur');
      var wasEdit = !!f.editingId;
      st.form = newForm();
      st.form.date = entry.date;
      if (f.mode === 'hours') { st.form.mode = 'hours'; st.form.hours = f.hours; }
      if (wasEdit) { st.week = L.weekStart(entry.date); go('week'); }
      else go('invullen');
    }

    var existing = f.editingId ? [] : L.entriesFor(data.entries, f.empId, f.date);
    if (existing.length) {
      confirmBox(empName(f.empId) + ' heeft op deze dag al ' + L.fmtHours(L.sumHours(existing)) + ' uur',
        'Wil je deze uren er toch bij zetten?', 'Ja, erbij zetten').then(function (ok) { if (ok) commit(); });
    } else commit();
  }

  function copyYesterday() {
    var f = st.form;
    if (!f.empId) { toast('Kies eerst wie er heeft gewerkt.', 'fout'); return; }
    var list = L.entriesFor(data.entries, f.empId, L.addDays(f.date, -1));
    if (!list.length) { toast('Geen invoer gisteren voor ' + empName(f.empId) + '.', 'fout'); return; }
    var e = list[list.length - 1];
    f.mode = e.mode;
    if (e.mode === 'times') { f.start = e.start; f.end = e.end; f.breakMin = e.breakMin || 0; }
    else f.hours = L.fmtHours(e.hours);
    f.note = e.note || '';
    renderInvullen();
    toast('Overgenomen van gisteren. Tik op Opslaan.');
  }

  function startEdit(id) {
    var e = data.entries.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    st.form = {
      empId: e.empId, date: e.date, mode: e.mode,
      start: e.start || data.prefs.start, end: e.end || data.prefs.end,
      breakMin: e.breakMin === undefined ? data.prefs.breakMin : e.breakMin,
      hours: e.mode === 'hours' ? L.fmtHours(e.hours) : '', note: e.note || '', editingId: e.id
    };
    go('invullen');
  }

  // ---------- scherm: week ----------
  function renderWeek() {
    var t = L.weekTable(data, st.week);
    var today = L.todayISO();
    var thisWeek = L.weekStart(today);
    var html = '<div class="weekbalk">' +
      '<button class="pijl" data-action="week-min" aria-label="Vorige week">←</button>' +
      '<div class="weektitel">' + esc(L.weekLabel(st.week)) + (st.week === thisWeek ? '<small>deze week</small>' : '') + '</div>' +
      '<button class="pijl" data-action="week-plus" aria-label="Volgende week">→</button></div>';
    if (st.week !== thisWeek) html += '<div class="chips noprint" style="margin:-4px 0 14px"><button class="chip" data-action="deze-week">Naar deze week</button></div>';

    if (!data.employees.length) {
      html += '<div class="blok leeg"><p>Er zijn nog geen medewerkers.</p><button class="knop primair groot" data-action="eerste-mens">Voeg je eerste medewerker toe</button></div>';
      $('#scherm').innerHTML = html; return;
    }
    if (!t.rows.length) {
      html += '<div class="blok leeg"><p>Er zijn nog geen actieve medewerkers.</p><button class="knop primair groot" data-action="naar-mensen">Naar Mensen</button></div>';
      $('#scherm').innerHTML = html; return;
    }

    html += '<h2 class="printtitel">' + esc(L.weekLabel(st.week)) + '</h2>';

    // tabel (breed scherm en print)
    html += '<table class="weektabel"><thead><tr><th scope="col" style="text-align:left;padding-left:14px">Naam</th>' +
      t.days.map(function (d, i) {
        return '<th scope="col" class="' + (d === today ? 'vandaag' : '') + '">' + L.DAGEN_KORT[i] + '<small>' + esc(L.korteDatum(d)) + '</small></th>';
      }).join('') + '<th scope="col">Totaal</th></tr></thead><tbody>' +
      t.rows.map(function (r) {
        return '<tr><th scope="row">' + esc(r.emp.name) + (r.emp.active ? '' : ' <small>(niet actief)</small>') + '</th>' +
          r.days.map(function (c) {
            return '<td><button class="cel' + (c.hours ? '' : ' leegcel') + (c.count > 1 ? ' meer' : '') + '" data-action="dag" data-emp="' + esc(r.emp.id) + '" data-date="' + c.date + '" aria-label="' +
              esc(r.emp.name + ', ' + L.langeDatum(c.date) + ': ' + (c.hours ? L.fmtHours(c.hours) + ' uur' : 'niets ingevuld')) + '">' + (c.hours ? L.fmtHours(c.hours) : '–') + '</button></td>';
          }).join('') + '<td class="tot">' + L.fmtHours(r.total) + '</td></tr>';
      }).join('') +
      '<tr class="alles"><th scope="row">Totaal</th>' + t.dayTotals.map(function (x) { return '<td>' + (x ? L.fmtHours(x) : '–') + '</td>'; }).join('') + '<td>' + L.fmtHours(t.grand) + '</td></tr>' +
      '</tbody></table>';

    // kaarten (telefoon)
    html += '<div class="kaarten">' + t.rows.map(function (r) {
      return '<div class="pers"><div class="pers-kop"><h3>' + esc(r.emp.name) + '</h3><strong>' + L.fmtHours(r.total) + ' uur</strong></div><div class="dagen">' +
        r.days.map(function (c, i) {
          return '<button class="dag' + (c.hours ? '' : ' leegcel') + (c.date === today ? ' vandaag' : '') + '" data-action="dag" data-emp="' + esc(r.emp.id) + '" data-date="' + c.date + '" aria-label="' +
            esc(r.emp.name + ', ' + L.langeDatum(c.date) + ': ' + (c.hours ? L.fmtHours(c.hours) + ' uur' : 'niets ingevuld')) + '"><span>' + L.DAGEN_KORT[i] + '</span><b>' + (c.hours ? L.fmtHours(c.hours) : '–') + '</b></button>';
        }).join('') + '</div></div>';
    }).join('') +
      '<div class="pers alles"><div class="pers-kop"><h3>Totaal iedereen</h3><strong>' + L.fmtHours(t.grand) + ' uur</strong></div><div class="dagen">' +
      t.dayTotals.map(function (x, i) { return '<div class="dag' + (x ? '' : ' leegcel') + '"><span>' + L.DAGEN_KORT[i] + '</span><b>' + (x ? L.fmtHours(x) : '–') + '</b></div>'; }).join('') +
      '</div></div></div>';

    html += '<div class="rij noprint" style="margin-top:16px"><button class="knop" data-action="print">Afdrukken</button>' +
      '<button class="knop" data-action="csv-week">Download voor Excel</button></div>';
    $('#scherm').innerHTML = html;
  }

  function openDay(empId, date) {
    var list = L.entriesFor(data.entries, empId, date);
    var body;
    if (!list.length) body = '<p>Nog niets ingevuld op deze dag.</p>';
    else body = '<ul class="dlg-lijst">' + list.map(function (e) {
      var wat = e.mode === 'times' ? e.start + ' tot ' + e.end + ', pauze ' + (e.breakMin || 0) + ' min' : 'Alleen uren';
      return '<li><div class="wat">' + L.fmtHours(L.entryHours(e)) + ' uur</div><div class="klein">' + esc(wat) + (e.note ? '<br>' + esc(e.note) : '') + '</div>' +
        '<div class="rij"><button class="knop" data-val="edit:' + esc(e.id) + '">Wijzig</button><button class="knop gevaar" data-val="del:' + esc(e.id) + '">Verwijder</button></div></li>';
    }).join('') + '</ul>';
    dialog(empName(empId) + ', ' + L.langeDatum(date), body, [
      { label: 'Uren toevoegen', value: 'add', cls: 'primair' },
      { label: 'Sluiten', value: 'close' }
    ]).then(function (r) {
      var v = r.value || '';
      if (v === 'add') {
        st.form = newForm(); st.form.empId = empId; st.form.date = date; go('invullen');
      } else if (v.indexOf('edit:') === 0) {
        startEdit(v.slice(5));
      } else if (v.indexOf('del:') === 0) {
        var id = v.slice(4);
        var e = list.filter(function (x) { return x.id === id; })[0];
        confirmBox('Verwijderen?', empName(empId) + ', ' + L.langeDatum(date) + ', ' + L.fmtHours(L.entryHours(e)) + ' uur. Dit kan niet ongedaan worden gemaakt.', 'Ja, verwijder', true).then(function (ok) {
          if (ok) {
            data.entries = data.entries.filter(function (x) { return x.id !== id; });
            save(); toast('Verwijderd'); render();
          }
          openDay(empId, date);
        });
      }
    });
  }

  // ---------- scherm: mensen ----------
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; if (st.tab === 'mensen') renderMensen(); });

  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  function renderMensen() {
    var html = '<section class="blok"><h2>Medewerkers</h2>';
    if (!data.employees.length) html += '<p class="uitleg">Nog niemand. Voeg je eerste medewerker toe.</p>';
    data.employees.forEach(function (e) {
      var n = data.entries.filter(function (x) { return x.empId === e.id; }).length;
      html += '<div class="mens' + (e.active ? '' : ' inactief') + '"><button class="mens-naam" data-action="hernoem" data-id="' + esc(e.id) + '">' + esc(e.name) +
        '<small>' + esc(L.tradeLabel(e.trade)) + (e.active ? '' : ' · niet meer actief') + ' · ' + n + ' invoer' + (n === 1 ? '' : 'en') + '</small></button>' +
        '<button class="knop" data-action="actief" data-id="' + esc(e.id) + '">' + (e.active ? 'Stop' : 'Weer actief') + '</button></div>';
    });
    html += '<div style="height:12px"></div><button class="knop primair vol" data-action="nieuw-mens">Medewerker toevoegen</button>' +
      '<p class="uitleg" style="margin:10px 0 0">Met Stop verdwijnt iemand uit het invulscherm. De oude uren blijven bewaard.</p></section>';

    html += '<section class="blok"><h2>Uren downloaden voor Excel</h2>' +
      '<button class="knop vol" data-action="csv-week">Week: ' + esc(L.weekLabel(st.week)) + '</button>' +
      '<div class="maandrij"><input type="month" id="f-month" value="' + esc(st.month) + '" aria-label="Kies een maand"><button class="knop" data-action="csv-maand">Download maand</button></div></section>';

    html += '<section class="blok"><h2>Afdrukken</h2><button class="knop vol" data-action="print-week">Weekoverzicht afdrukken</button></section>';

    html += '<section class="blok"><h2>Back-up</h2><p class="uitleg">Je uren staan alleen op dit apparaat. Maak daarom af en toe een back-up en bewaar die in je mail of op een andere plek.' +
      (data.lastBackup ? ' Laatste back-up: ' + esc(L.langeDatum(data.lastBackup)) + '.' : ' Je hebt nog geen back-up gemaakt.') + '</p>' +
      '<div class="rij"><button class="knop primair" data-action="backup">Back-up maken</button><button class="knop" data-action="herstel">Back-up terugzetten</button></div>' +
      '<input type="file" id="f-herstel" accept="application/json,.json" hidden></section>';

    if (!isStandalone()) {
      html += '<section class="blok"><h2>Op het beginscherm zetten</h2>';
      if (installEvent) {
        html += '<button class="knop primair vol" data-action="installeer">Installeer de app</button>';
      } else if (isIOS()) {
        html += '<ol class="stappen"><li>Open deze pagina in Safari.</li><li>Tik onderin op Deel (het vierkantje met de pijl).</li><li>Tik op Zet op beginscherm.</li></ol><p class="uitleg">Daarna staat Uren tussen je andere apps.</p>';
      } else {
        html += '<p class="uitleg">Open het menu van je browser (de drie puntjes) en kies Installeer app of Toevoegen aan startscherm.</p>';
      }
      html += '</section>';
    }
    $('#scherm').innerHTML = html;
  }

  // ---------- bestanden ----------
  function csvWeek() {
    var csv = L.csvFor(data, st.week, L.addDays(st.week, 6));
    saveFile('uren-week-' + L.isoWeek(st.week) + '-' + st.week.slice(0, 4) + '.csv', 'text/csv', csv, true);
  }
  function csvMonth() {
    var inp = $('#f-month');
    var m = (inp && inp.value) || st.month;
    st.month = m;
    var r = L.monthRange(m);
    saveFile('uren-' + m + '.csv', 'text/csv', L.csvFor(data, r.from, r.to), true);
  }
  function makeBackup() {
    var json = JSON.stringify(data, null, 1);
    saveFile('uren-backup-' + L.todayISO() + '.json', 'application/json', json, false).then(function (ok) {
      if (!ok) return;
      data.lastBackup = L.todayISO(); save(); toast('Back-up gemaakt'); render();
    });
  }
  function restoreFrom(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var d;
      try { d = JSON.parse(rd.result); } catch (e) { d = null; }
      if (!valid(d)) { toast('Dit bestand is geen back-up van Uren.', 'fout'); return; }
      confirmBox('Back-up terugzetten?', 'Dit vervangt alles wat nu in de app staat (' + data.entries.length + ' invoeren) door de back-up (' + d.entries.length + ' invoeren).', 'Ja, terugzetten', true).then(function (ok) {
        if (!ok) return;
        try { localStorage.setItem(KEY + '-voor-terugzetten', JSON.stringify(data)); } catch (e) { /* niet erg */ }
        data = normalize(d); save();
        st.form = newForm();
        toast('Back-up teruggezet'); render();
      });
    };
    rd.readAsText(file);
  }

  // ---------- knoppen en velden ----------
  document.addEventListener('click', function (ev) {
    var tab = ev.target.closest('.tab');
    if (tab) { go(tab.dataset.tab); return; }
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    var f = st.form;
    switch (el.dataset.action) {
      case 'kies': f.empId = el.dataset.id; renderInvullen(); break;
      case 'dag-min': f.date = L.addDays(f.date, -1); renderInvullen(); break;
      case 'dag-plus': f.date = L.addDays(f.date, 1); renderInvullen(); break;
      case 'vandaag': f.date = L.todayISO(); renderInvullen(); break;
      case 'mode': f.mode = el.dataset.mode; renderInvullen(); break;
      case 'pauze': f.breakMin = Number(el.dataset.min); renderInvullen(); break;
      case 'uren': f.hours = el.dataset.h; renderInvullen(); break;
      case 'opslaan': saveEntry(); break;
      case 'gisteren': copyYesterday(); break;
      case 'wijzig': startEdit(el.dataset.id); break;
      case 'annuleer-wijzig': st.form = newForm(); go('invullen'); break;
      case 'week-min': st.week = L.addDays(st.week, -7); renderWeek(); break;
      case 'week-plus': st.week = L.addDays(st.week, 7); renderWeek(); break;
      case 'deze-week': st.week = L.weekStart(L.todayISO()); renderWeek(); break;
      case 'dag': openDay(el.dataset.emp, el.dataset.date); break;
      case 'print': window.print(); break;
      case 'print-week': go('week'); setTimeout(function () { window.print(); }, 150); break;
      case 'csv-week': csvWeek(); break;
      case 'csv-maand': csvMonth(); break;
      case 'backup': makeBackup(); break;
      case 'herstel': $('#f-herstel').click(); break;
      case 'eerste-mens':
      case 'nieuw-mens': addEmployee(); break;
      case 'naar-mensen': go('mensen'); break;
      case 'hernoem': renameEmployee(el.dataset.id); break;
      case 'beroep':
        el.parentNode.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === el)); });
        break;
      case 'actief': toggleActive(el.dataset.id); break;
      case 'installeer':
        if (installEvent) { installEvent.prompt(); installEvent.userChoice.then(function () { installEvent = null; renderMensen(); }); }
        break;
    }
  });
  // Op een computer opent een klik op de datum meteen de kalender.
  document.addEventListener('click', function (ev) {
    if (ev.target.id === 'f-date' && ev.target.showPicker) { try { ev.target.showPicker(); } catch (e) { /* niet erg */ } }
  });

  document.addEventListener('input', function (ev) {
    var id = ev.target.id, f = st.form;
    if (id === 'f-start') { f.start = ev.target.value; updatePreview(); }
    else if (id === 'f-end') { f.end = ev.target.value; updatePreview(); }
    else if (id === 'f-break') { f.breakMin = ev.target.value; updatePreview(); document.querySelectorAll('[data-action="pauze"]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(f.breakMin) === Number(b.dataset.min))); }); }
    else if (id === 'f-hours') { f.hours = ev.target.value; updatePreview(); document.querySelectorAll('[data-action="uren"]').forEach(function (b) { b.setAttribute('aria-pressed', String(f.hours === b.dataset.h)); }); }
    else if (id === 'f-note') { f.note = ev.target.value; }
  });
  document.addEventListener('change', function (ev) {
    var id = ev.target.id;
    if (id === 'f-date' && ev.target.value) { st.form.date = ev.target.value; renderInvullen(); }
    else if (id === 'f-month') { st.month = ev.target.value || st.month; }
    else if (id === 'f-herstel' && ev.target.files[0]) { restoreFrom(ev.target.files[0]); ev.target.value = ''; }
  });

  function addEmployee() {
    askPerson('Nieuwe medewerker', '', 'overig', 'Toevoegen').then(function (p) {
      if (!p) return;
      var name = p.name;
      var dup = data.employees.some(function (e) { return e.name.toLowerCase() === name.toLowerCase(); });
      if (dup) { toast(name + ' staat er al.', 'fout'); return; }
      data.employees.push({ id: L.uid(), name: name, active: true, trade: p.trade });
      save(); toast(name + ' toegevoegd');
      if (data.employees.length === 1 || st.tab === 'invullen' || st.tab === 'week') { go(data.employees.length === 1 ? 'invullen' : st.tab); } else render();
    });
  }
  function renameEmployee(id) {
    var e = data.employees.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    askPerson('Naam en beroep', e.name, e.trade, 'Opslaan').then(function (p) {
      if (!p) return;
      e.name = p.name; e.trade = p.trade; save(); render();
    });
  }
  function toggleActive(id) {
    var e = data.employees.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    if (e.active && data.clock[e.id]) { toast('Klok eerst uit: ' + e.name + ' is nog ingeklokt.', 'fout'); return; }
    if (e.active) {
      confirmBox(e.name + ' niet meer actief?', 'De naam verdwijnt uit het invulscherm. De oude uren blijven bewaard en je kunt de naam later weer actief maken.', 'Ja, stop', false).then(function (ok) {
        if (ok) { e.active = false; if (st.form.empId === e.id) st.form.empId = null; save(); render(); }
      });
    } else { e.active = true; save(); render(); }
  }

  // ---------- start ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline-werking is een extraatje */ }); });
  }
  go('invullen');
})();
