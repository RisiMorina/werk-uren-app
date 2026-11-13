/* Mijn uren: schermen, opslag en knoppen. De rekenregels staan in logic.js. */
(function () {
  'use strict';
  var L = window.Logic;
  var KEY = 'mijn-uren-v1';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var DAG_KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  var MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var LETTER = { vrij: 'V', ziek: 'Z', vakantie: 'Vk', feestdag: 'F' };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- opslag ----------
  function emptyData() {
    return { version: 1, days: {}, lastBackup: null, firstUse: L.todayISO(), prefs: { start: '08:00', end: '17:00', breakMin: 30 } };
  }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* geen toegang */ }
    if (raw) {
      try { var d = JSON.parse(raw); if (L.isValidData(d)) return L.upgradeData(d); } catch (e) { /* hieronder: bewaren */ }
      // Wat we niet kunnen lezen bewaren we apart, zodat het volgende opslaan het niet wist.
      try { localStorage.setItem(KEY + '-onleesbaar', raw); } catch (e) { /* niet erg */ }
    }
    return emptyData();
  }
  var data = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { toast('Opslaan lukt niet. Maak een back-up!', 'fout'); }
  }
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* niet erg */ } }

  // ---------- staat ----------
  var st = { tab: 'invullen', month: L.todayISO().slice(0, 7), form: null };
  function blankForm(date) {
    var p = data.prefs;
    return { date: date, group: 'gewerkt', reason: null, mode: 'times', start: p.start, end: p.end, breakMin: p.breakMin, hours: '', note: '' };
  }
  // Formulier voor een datum: staat er al iets, dan zie je dat. Anders houd je de keuzes van de vorige dag, zonder notitie.
  function formFor(date, prev) {
    var f = prev ? JSON.parse(JSON.stringify(prev)) : blankForm(date);
    var r = data.days[date];
    f.date = date;
    f.note = '';
    if (!r) { f.reason = null; f.hours = ''; return f; }   // een nieuwe dag begint zonder gekozen reden of uren, zodat je nooit per ongeluk iets oudsts opslaat
    f.note = r.note || '';
    if (r.kind === 'gewerkt') {
      f.group = 'gewerkt'; f.mode = r.mode;
      if (r.mode === 'times') { f.start = r.start; f.end = r.end; f.breakMin = r.breakMin; }
      else f.hours = L.fmtHours(r.hours);
    } else { f.group = 'niet'; f.reason = r.kind; }
    return f;
  }
  st.form = formFor(L.todayISO(), null);

  // ---------- hulpen ----------
  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function korteDatum(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + MAAND_KORT[+p[1] - 1]; }
  function dagen(n) { return n + ' ' + (n === 1 ? 'dag' : 'dagen'); }
  function recText(r) {
    if (!r) return '';
    if (r.kind === 'gewerkt') {
      return L.fmtHours(L.recHours(r)) + ' uur' + (r.mode === 'times' ? ' (' + r.start + ' tot ' + r.end + ', pauze ' + (r.breakMin || 0) + ' min)' : '');
    }
    return L.kindLabel(r.kind);
  }

  // Pop-up. Hij is klaar zodra je een knop kiest; het 'close'-signaal van een vorige pop-up negeren we.
  function dialog(title, body, buttons) {
    return new Promise(function (resolve) {
      var d = $('#dlg');
      d.innerHTML = '<h2>' + esc(title) + '</h2><div class="dlg-body">' + body + '</div><div class="dlg-knoppen">' +
        buttons.map(function (b) { return '<button class="knop ' + (b.cls || '') + '" data-val="' + esc(b.value) + '">' + esc(b.label) + '</button>'; }).join('') + '</div>';
      var finished = false;
      function done(val) {
        if (finished) return;
        finished = true;
        d.removeEventListener('click', onClick);
        d.removeEventListener('close', onClose);
        if (d.open) d.close();
        resolve({ value: val });
      }
      function onClick(e) { var b = e.target.closest('[data-val]'); if (b) done(b.getAttribute('data-val')); }
      function onClose() { if (!d.open) done(null); }
      d.addEventListener('click', onClick);
      d.addEventListener('close', onClose);
      d.showModal();
    });
  }
  function confirmBox(title, text, okLabel, danger) {
    return dialog(title, '<p>' + esc(text) + '</p>', [
      { label: okLabel, value: 'ja', cls: 'primair' + (danger ? ' gevaar' : '') },
      { label: 'Nee, terug', value: 'nee' }
    ]).then(function (r) { return r.value === 'ja'; });
  }

  function saveFile(name, mime, text, bom) {
    var blob = new Blob([bom ? '﻿' : '', text], { type: mime + ';charset=utf-8' });
    var file;
    try { file = new File([blob], name, { type: mime }); } catch (e) { file = null; }
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
  var TITELS = { invullen: 'Uren invullen', maand: 'Maandoverzicht', bestanden: 'Bestanden' };
  function go(tab) {
    st.tab = tab;
    document.querySelectorAll('.tab').forEach(function (b) {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#titel').textContent = TITELS[tab];
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    renderBanner();
    if (st.tab === 'invullen') renderInvullen();
    else if (st.tab === 'maand') renderMaand();
    else renderBestanden();
  }

  // ---------- back-up herinnering ----------
  function backupDue() {
    if (!Object.keys(data.days).length) return false;
    var ref = data.lastBackup || data.firstUse;
    return (L.parseISO(L.todayISO()) - L.parseISO(ref)) / 86400000 > 14;
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
  function datumHtml(iso) {
    var t = L.todayISO();
    var extra = iso === t ? 'vandaag' : iso === L.addDays(t, -1) ? 'gisteren' : iso === L.addDays(t, 1) ? 'morgen' : '';
    return esc(L.langeDatum(iso)) + (extra ? '<small>' + extra + '</small>' : '');
  }
  function renderInvullen() {
    var f = st.form, existing = data.days[f.date];
    var html = '<section class="blok"><h2>Welke dag?</h2><div class="datumrij">' +
      '<button class="pijl" data-action="dag-min" aria-label="Een dag eerder">‹</button>' +
      '<label class="datum"><span>' + datumHtml(f.date) + '</span><input type="date" id="f-date" value="' + esc(f.date) + '" aria-label="Kies een datum"></label>' +
      '<button class="pijl" data-action="dag-plus" aria-label="Een dag later">›</button></div>' +
      (f.date === L.todayISO() ? '' : '<div class="chips"><button class="chip" data-action="vandaag">Naar vandaag</button></div>') + '</section>';

    if (existing) {
      html += '<div class="bestaand"><span>Deze dag is al ingevuld: ' + esc(recText(existing)) + '</span>' +
        '<button class="knop gevaar" data-action="verwijder-dag">Verwijder deze dag</button></div>';
    }

    html += '<section class="blok"><div class="tweekeuze">' +
      '<button class="keuze" data-action="groep" data-groep="gewerkt" aria-pressed="' + (f.group === 'gewerkt') + '">Gewerkt</button>' +
      '<button class="keuze" data-action="groep" data-groep="niet" aria-pressed="' + (f.group === 'niet') + '">Niet gewerkt</button></div></section>';

    if (f.group === 'gewerkt') {
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
            return '<button class="chip" data-action="pauze" data-min="' + m + '" aria-pressed="' + (L.cleanBreak(f.breakMin) === m) + '">' + m + '</button>';
          }).join('') + '</div></div></div>';
      } else {
        html += '<div class="veld"><label for="f-hours">Aantal uren</label><input type="text" id="f-hours" inputmode="decimal" autocomplete="off" placeholder="bijvoorbeeld 7,5" value="' + esc(f.hours) + '">' +
          '<div class="chips">' + ['4', '6', '7,5', '8'].map(function (h) {
            return '<button class="chip" data-action="uren" data-h="' + h + '" aria-pressed="' + (f.hours === h) + '">' + h + '</button>';
          }).join('') + '</div></div>';
      }
      html += '<div class="totaal"><span>Totaal</span><strong id="totaal">' + L.fmtHours(formHours()) + ' uur</strong></div></section>';
    } else {
      html += '<section class="blok"><h2>Waarom niet?</h2><div class="redenen">' +
        L.KINDS.map(function (k) {
          return '<button class="keuze reden reden-' + k.id + '" data-action="reden" data-reden="' + k.id + '" aria-pressed="' + (f.reason === k.id) + '">' + esc(k.label) + '</button>';
        }).join('') + '</div></section>';
    }

    html += '<section class="blok"><div class="veld"><label for="f-note">Notitie (mag leeg blijven)</label>' +
      '<input type="text" class="notitie" id="f-note" maxlength="120" autocomplete="off" value="' + esc(f.note) + '"></div></section>';
    html += '<div class="blok kaal"><button class="knop primair groot vol" data-action="opslaan">' + (existing ? 'Wijziging opslaan' : 'Opslaan') + '</button></div>';
    $('#scherm').innerHTML = html;
  }
  function updatePreview() { var t = $('#totaal'); if (t) t.textContent = L.fmtHours(formHours()) + ' uur'; }

  function buildRec() {
    var f = st.form;
    if (f.group === 'gewerkt') {
      var rec = { date: f.date, kind: 'gewerkt', mode: f.mode, note: f.note };
      if (f.mode === 'times') { rec.start = f.start; rec.end = f.end; rec.breakMin = f.breakMin; }
      else { var h = L.parseHours(f.hours); rec.hours = h === null ? '' : h; }
      return rec;
    }
    return { date: f.date, kind: f.reason || '', note: f.note };
  }
  function saveDay() {
    var rec = buildRec(), v = L.validateRec(rec);
    if (!v.ok) { toast(v.error, 'fout'); return; }
    function commit() {
      L.setDay(data, rec);
      if (rec.kind === 'gewerkt' && rec.mode === 'times') data.prefs = { start: rec.start, end: rec.end, breakMin: L.cleanBreak(rec.breakMin) };
      save();
      var saved = data.days[rec.date];
      toast('Opgeslagen: ' + L.langeDatum(rec.date) + ', ' + (saved.kind === 'gewerkt' ? L.fmtHours(L.recHours(saved)) + ' uur' : L.kindLabel(saved.kind)));
      st.form = formFor(rec.date, st.form);
      render();
    }
    if (data.days[rec.date]) {
      confirmBox(L.langeDatum(rec.date) + ' is al ingevuld', 'Nu staat er: ' + recText(data.days[rec.date]) + '. Wil je dit vervangen?', 'Ja, vervang', false).then(function (ok) { if (ok) commit(); });
    } else commit();
  }
  function deleteDay(date, after) {
    var r = data.days[date];
    if (!r) return;
    confirmBox('Verwijderen?', L.langeDatum(date) + ': ' + recText(r) + '. Dit kan niet ongedaan worden gemaakt.', 'Ja, verwijder', true).then(function (ok) {
      if (!ok) { if (after) after(false); return; }
      L.removeDay(data, date);
      save();
      toast('Verwijderd');
      if (st.form.date === date) st.form = formFor(date, st.form);
      render();
      if (after) after(true);
    });
  }
  function setDate(date) { st.form = formFor(date, st.form); renderInvullen(); }

  // ---------- scherm: maand ----------
  function renderMaand() {
    var ym = st.month, s = L.monthSummary(data, ym), today = L.todayISO(), thisMonth = today.slice(0, 7);
    var html = '<div class="maandbalk"><button class="pijl" data-action="maand-min" aria-label="Vorige maand">←</button>' +
      '<div class="maandtitel">' + esc(L.monthLabel(ym)) + (ym === thisMonth ? '<small>deze maand</small>' : '') + '</div>' +
      '<button class="pijl" data-action="maand-plus" aria-label="Volgende maand">→</button></div>';
    if (ym !== thisMonth) html += '<div class="chips" style="margin:-4px 0 14px"><button class="chip" data-action="deze-maand">Naar deze maand</button></div>';

    html += '<section class="blok samen"><div class="totaal" style="margin-top:0"><span>Totaal</span><strong>' + L.fmtHours(s.hours) + ' uur</strong></div>' +
      '<p>' + dagen(s.daysWorked) + ' gewerkt</p>' +
      L.KINDS.filter(function (k) { return s.off[k.id] > 0; }).map(function (k) { return '<p>' + dagen(s.off[k.id]) + ' ' + esc(k.label.toLowerCase()) + '</p>'; }).join('') + '</section>';

    html += '<section class="blok"><div class="kop7">' + DAG_KORT.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      L.monthGrid(ym).map(function (row) {
        return '<div class="rij7">' + row.map(function (date) {
          if (!date) return '<div class="leeg7"></div>';
          var r = data.days[date], h = L.recHours(r), cls = 'dag' + (r ? ' ' + r.kind : '') + (date === today ? ' vandaag' : '') + (date > today ? ' toekomst' : '');
          var val = !r ? '' : r.kind === 'gewerkt' ? L.fmtHours(h) : LETTER[r.kind];
          var label = L.langeDatum(date) + (r ? ': ' + recText(r) : ': niets ingevuld');
          return '<button class="' + cls + '" data-action="dag" data-date="' + date + '" aria-label="' + esc(label) + '"><span>' + (+date.slice(8)) + '</span><b>' + (val || '&nbsp;') + '</b></button>';
        }).join('') + '</div>';
      }).join('') +
      '<p class="legenda">V vrij, Z ziek, Vk vakantie, F feestdag</p></section>';

    html += '<section class="blok"><h2>Per week</h2>' + s.weeks.map(function (w) {
      return '<div class="weekregel"><span>Week ' + w.week + '<small>' + esc(korteDatum(w.from)) + ' t/m ' + esc(korteDatum(w.to)) + (w.partial ? ' (deel van de week)' : '') + '</small></span>' +
        '<strong>' + L.fmtHours(w.hours) + ' uur</strong></div>';
    }).join('') + '</section>';
    $('#scherm').innerHTML = html;
  }

  function openDay(date) {
    var r = data.days[date];
    var body = r ? '<p><b>' + esc(recText(r)) + '</b></p>' + (r.note ? '<p class="uitleg" style="margin-top:6px">' + esc(r.note) + '</p>' : '') : '<p>Nog niets ingevuld op deze dag.</p>';
    var buttons = [{ label: r ? 'Wijzig' : 'Invullen', value: 'edit', cls: 'primair' }];
    if (r) buttons.push({ label: 'Verwijder', value: 'del', cls: 'gevaar' });
    buttons.push({ label: 'Sluiten', value: 'close' });
    dialog(L.langeDatum(date), body, buttons).then(function (res) {
      if (res.value === 'edit') { st.form = formFor(date, st.form); go('invullen'); }
      else if (res.value === 'del') deleteDay(date, function () { openDay(date); });
    });
  }

  // ---------- scherm: bestanden ----------
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; if (st.tab === 'bestanden') renderBestanden(); });
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  function renderBestanden() {
    var html = '<section class="blok"><h2>Uren downloaden voor Excel</h2>' +
      '<div class="maandrij"><input type="month" id="f-month" value="' + esc(st.month) + '" aria-label="Kies een maand"><button class="knop primair" data-action="csv">Download</button></div></section>';
    html += '<section class="blok"><h2>Back-up</h2><p class="uitleg" style="margin-bottom:12px">Je uren staan alleen op dit apparaat. Maak daarom af en toe een back-up en bewaar die in je mail of op een andere plek.' +
      (data.lastBackup ? ' Laatste back-up: ' + esc(L.langeDatum(data.lastBackup)) + '.' : ' Je hebt nog geen back-up gemaakt.') + '</p>' +
      '<div class="rij"><button class="knop primair" data-action="backup">Back-up maken</button><button class="knop" data-action="herstel">Back-up terugzetten</button></div>' +
      '<input type="file" id="f-herstel" accept="application/json,.json" hidden></section>';
    if (!isStandalone()) {
      html += '<section class="blok"><h2>Op het beginscherm zetten</h2>';
      if (installEvent) html += '<button class="knop primair vol" data-action="installeer">Installeer de app</button>';
      else if (isIOS()) html += '<ol class="stappen"><li>Open deze pagina in Safari.</li><li>Tik onderin op Deel (het vierkantje met de pijl).</li><li>Tik op Zet op beginscherm.</li></ol><p class="uitleg">Daarna staat Mijn uren tussen je andere apps.</p>';
      else html += '<p class="uitleg">Open het menu van je browser (de drie puntjes) en kies Installeer app of Toevoegen aan startscherm.</p>';
      html += '</section>';
    }
    $('#scherm').innerHTML = html;
  }
  function csvMonth() {
    var inp = $('#f-month'), ym = (inp && /^\d{4}-\d{2}$/.test(inp.value) && inp.value) || st.month;
    st.month = ym;
    saveFile('mijn-uren-' + ym + '.csv', 'text/csv', L.csvForMonth(data, ym), true);
  }
  function makeBackup() {
    saveFile('mijn-uren-backup-' + L.todayISO() + '.json', 'application/json', JSON.stringify(data, null, 1), false).then(function (ok) {
      if (!ok) return;
      data.lastBackup = L.todayISO(); save(); toast('Back-up gemaakt'); render();
    });
  }
  function restoreFrom(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var d;
      try { d = JSON.parse(rd.result); } catch (e) { d = null; }
      if (!L.isValidData(d)) { toast('Dit bestand is geen back-up van Mijn uren.', 'fout'); return; }
      try { d = L.upgradeData(d); } catch (e) { toast('Dit bestand is geen back-up van Mijn uren.', 'fout'); return; }
      confirmBox('Back-up terugzetten?', 'Dit vervangt alles wat nu in de app staat (' + Object.keys(data.days).length + ' dagen) door de back-up (' + Object.keys(d.days).length + ' dagen).', 'Ja, terugzetten', true).then(function (ok) {
        if (!ok) return;
        try { localStorage.setItem(KEY + '-voor-terugzetten', JSON.stringify(data)); } catch (e) { /* niet erg */ }
        data = d; save();
        st.form = formFor(st.form.date, st.form);
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
      case 'dag-min': setDate(L.addDays(f.date, -1)); break;
      case 'dag-plus': setDate(L.addDays(f.date, 1)); break;
      case 'vandaag': setDate(L.todayISO()); break;
      case 'groep': f.group = el.dataset.groep; renderInvullen(); break;
      case 'reden': f.reason = el.dataset.reden; renderInvullen(); break;
      case 'mode': f.mode = el.dataset.mode; renderInvullen(); break;
      case 'pauze': f.breakMin = Number(el.dataset.min); renderInvullen(); break;
      case 'uren': f.hours = el.dataset.h; renderInvullen(); break;
      case 'opslaan': saveDay(); break;
      case 'verwijder-dag': deleteDay(f.date); break;
      case 'maand-min': st.month = L.shiftMonth(st.month, -1); renderMaand(); break;
      case 'maand-plus': st.month = L.shiftMonth(st.month, 1); renderMaand(); break;
      case 'deze-maand': st.month = L.todayISO().slice(0, 7); renderMaand(); break;
      case 'dag': openDay(el.dataset.date); break;
      case 'csv': csvMonth(); break;
      case 'backup': makeBackup(); break;
      case 'herstel': $('#f-herstel').click(); break;
      case 'installeer':
        if (installEvent) { installEvent.prompt(); installEvent.userChoice.then(function () { installEvent = null; renderBestanden(); }); }
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
    else if (id === 'f-break') {
      f.breakMin = ev.target.value; updatePreview();
      document.querySelectorAll('[data-action="pauze"]').forEach(function (b) { b.setAttribute('aria-pressed', String(L.cleanBreak(f.breakMin) === Number(b.dataset.min))); });
    } else if (id === 'f-hours') {
      f.hours = ev.target.value; updatePreview();
      document.querySelectorAll('[data-action="uren"]').forEach(function (b) { b.setAttribute('aria-pressed', String(f.hours === b.dataset.h)); });
    } else if (id === 'f-note') f.note = ev.target.value;
  });
  document.addEventListener('change', function (ev) {
    var id = ev.target.id;
    if (id === 'f-date' && L.validDate(ev.target.value)) setDate(ev.target.value);
    else if (id === 'f-month' && /^\d{4}-\d{2}$/.test(ev.target.value)) st.month = ev.target.value;
    else if (id === 'f-herstel' && ev.target.files[0]) { restoreFrom(ev.target.files[0]); ev.target.value = ''; }
  });

  // ---------- start ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline-werking is een extraatje */ }); });
  }
  go('invullen');
})();
