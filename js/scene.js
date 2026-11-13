/* Werkvloer: tekent de scene op een canvas. Alles is gebouwd van blokjes (kubus()).
   De regels (plekken, lopen) staan in scene-model.js.
   Gebruik: Scene.mount(canvas, onTap); Scene.setPeople(lijst); Scene.start(); Scene.stop(); */
(function (root) {
  'use strict';
  var M = root.SceneModel;
  var iso = M.iso;

  var WALL = 84;        // hoogte van de twee achtermuren (beeldpunten)
  var LOW = 14;         // hoogte van de lage voor- en zijmuur
  var BENCH_H = 10;     // zithoogte van het bankje
  var TAP_RADIUS = 32;  // tikzone rond een poppetje, in schermpunten
  var FS = 1.5;         // poppetjes zijn zo veel keer groter getekend dan hun tegels
  var SLAB = { x0: -0.6, y0: -0.6, x1: 11.9, y1: 8.2 };

  var C = {
    bg: '#E3EAEE', slab: '#C3CCD2', floor: '#9AA6AE', brick: '#B5543C', white: '#F3F3F0',
    tileA: '#E6B85C', tileB: '#D49A3A', wood: '#C98F4B', woodDark: '#A06F34', bench: '#7A5230',
    copper: '#D08A3B', blue: '#1B4F8F', yellow: '#F2B705', grey: '#8A97A1', dark: '#33414D', skin: '#E8B98F'
  };
  var BODY = { elektricien: '#F2B705', vloerlegger: '#E07B2D', schilder: '#F4F4F2', loodgieter: '#1B4F8F', timmerman: '#3F8F5A', overig: '#6C7A89' };

  var canvas, ctx, tapFn = null;
  var dpr = 1, cssW = 0, cssH = 0, scale = 1, ox = 0, oy = 0;
  var figs = {}, list = [], layoutMap = {};
  var raf = 0, running = false, lastT = 0, clock = 0;
  var mq = null, reduced = false;
  var props = null;

  // ---------- kleuren ----------
  var memo = {};
  function toRGB(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^hsl\((\d+),(\d+)%,(\d+)%\)$/.exec(c);
    if (!m) return [128, 128, 128];
    var h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  function shade(c, k) {
    var key = c + k;
    if (memo[key]) return memo[key];
    var r = toRGB(c), t = k < 0 ? 0 : 255, p = Math.abs(k);
    return (memo[key] = 'rgb(' + r.map(function (v) { return Math.round(v + (t - v) * p); }).join(',') + ')');
  }

  // ---------- blokjes ----------
  function poly(pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  // Eén blok: x, y in tegels, z en h in beeldpunten, w en d in tegels. Drie zichtbare vlakken.
  function kubus(x, y, z, w, d, h, color) {
    var a = iso(x, y, z + h), b = iso(x + w, y, z + h), c = iso(x + w, y + d, z + h), e = iso(x, y + d, z + h);
    poly([a, b, c, e], shade(color, 0.18));
    if (h > 0) {
      poly([e, c, iso(x + w, y + d, z), iso(x, y + d, z)], color);
      poly([b, c, iso(x + w, y + d, z), iso(x + w, y, z)], shade(color, -0.22));
    }
  }
  function vlak(x, y, z, w, d, color) { kubus(x, y, z, w, d, 0, color); }

  // ---------- vaste dingen: achtergrond ----------
  function drawGround() {
    // het hele terrein als een plaat, als een speelgoedwereld
    kubus(SLAB.x0, SLAB.y0, -8, SLAB.x1 - SLAB.x0, SLAB.y1 - SLAB.y0, 8, C.slab);
    // vloer van het gebouw
    kubus(0, 0, 0, 8, 6, 2, C.floor);
    // het gelegde stuk vloer: tegels in twee kleuren
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      vlak(4 + i, 2 + j, 2, 1, 1, (i + j) % 2 ? C.tileA : C.tileB);
    }
  }
  function drawBackWalls() {
    // achtermuur (y = 0) met meterkast en draden
    kubus(0, 0, 2, 8, 0.3, WALL, C.brick);
    kubus(1.7, 0.3, 24, 1.5, 0.12, 40, C.grey);
    kubus(1.85, 0.42, 52, 0.5, 0.04, 8, C.yellow);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 2;
    var w1 = iso(3.2, 0.42, 40), w2 = iso(5.4, 0.42, 66), w3 = iso(7.4, 0.42, 30);
    ctx.beginPath(); ctx.moveTo(w1.sx, w1.sy); ctx.lineTo(w2.sx, w2.sy); ctx.lineTo(w3.sx, w3.sy); ctx.stroke();
    // linkermuur (x = 0), een stuk wit geschilderd
    kubus(0, 0, 2, 0.3, 6, WALL, C.brick);
    kubus(0.3, 1.5, 12, 0.05, 3.6, 62, C.white);
  }

  // ---------- vaste dingen die tussen de poppetjes moeten sorteren ----------
  function buildProps() {
    var p = [];
    function add(cx, cy, fn) { p.push({ depth: cx + cy, draw: fn }); }
    function box(x, y, z, w, d, h, color) { add(x + w / 2, y + d / 2, function () { kubus(x, y, z, w, d, h, color); }); }
    var i;
    // lage muren met een opening bij y = 3
    for (i = 0; i < 8; i++) box(i, 5.75, 2, 1, 0.25, LOW, C.brick);           // voor
    [0, 1, 2].forEach(function (j) { box(7.75, j * 0.84, 2, 0.25, 0.84, LOW, C.brick); });
    [3.5, 4.34, 5.18].forEach(function (y) { box(7.75, y, 2, 0.25, 0.84, LOW, C.brick); });
    // houten frame (timmerman)
    [[6.2, 0.6], [7.5, 0.6], [6.2, 2.1], [7.5, 2.1]].forEach(function (q) { box(q[0], q[1], 2, 0.15, 0.15, 74, C.wood); });
    for (i = 0; i < 2; i++) {
      box(6.2 + i * 1.3, 0.6, 76, 0.15, 1.65, 7, C.woodDark);
    }
    box(6.2, 0.6, 76, 1.45, 0.15, 7, C.woodDark);
    box(6.2, 2.1, 76, 1.45, 0.15, 7, C.woodDark);
    // leidingen (loodgieter), per tegel zodat ze goed sorteren
    for (i = 0; i < 6; i++) box(1.5 + i, 5.4, 2, 1, 0.14, 7, C.copper);
    box(3.1, 5.4, 2, 0.3, 0.3, 12, C.blue);
    box(5.6, 5.4, 2, 0.3, 0.3, 12, C.blue);
    // stapel planken (overig), stapel tegels, verfemmer, kabelhaspel
    box(1.1, 3.9, 2, 0.8, 0.25, 4, C.wood); box(1.1, 3.9, 6, 0.8, 0.25, 4, C.woodDark); box(1.1, 3.9, 10, 0.8, 0.25, 4, C.wood);
    box(3.7, 2.1, 2, 0.35, 0.35, 12, C.tileA);
    box(1.35, 2.0, 2, 0.22, 0.22, 10, C.blue);
    box(4.2, 0.55, 2, 0.4, 0.4, 14, C.copper);
    // bankjes: per zitplaats een stukje, zodat poppetjes goed sorteren
    for (i = 0; i < 16; i++) {
      var s = M.benchSeat(i);
      box(s.x - 0.25, s.y - 0.45, 0, 0.5, 0.9, BENCH_H, C.bench);
      p[p.length - 1].depth -= 0.05;
      box(s.x - 0.33, s.y - 0.45, BENCH_H, 0.08, 0.9, 16, C.woodDark); // rugleuning
      p[p.length - 1].depth -= 0.1;
    }
    return p;
  }

  // ---------- poppetjes ----------
  function hashPhase(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return (h % 628) / 100; }

  // positie zoals getekend (de overige bouwvakker loopt heen en weer met een plank)
  function visual(f, t) {
    var x = f.x, y = f.y, moving = f.moving;
    if (!reduced && f.state === 'working' && f.trade === 'overig') {
      var s = Math.sin(t * 0.7 + f.ph);
      x += (s + 1) / 2 * 1.3;
      moving = Math.abs(Math.cos(t * 0.7 + f.ph)) > 0.12;
    }
    return { x: x, y: y, moving: moving };
  }

  function drawFigure(f, t) {
    var v = visual(f, t);
    // het poppetje wordt groter getekend dan de tegels, anders is hij op een telefoon te klein
    var foot = iso(v.x, v.y, 0);
    ctx.save();
    ctx.translate(foot.sx, foot.sy);
    ctx.scale(FS, FS);
    var x = 0, y = 0;
    var seated = f.state === 'bench';
    var working = f.state === 'working';
    var tt = reduced ? 0 : t;
    var walk = v.moving && !reduced ? Math.sin(f.walkPhase) : 0;
    var base = seated ? BENCH_H / FS : 0;
    var crouch = working && (f.trade === 'vloerlegger' || f.trade === 'loodgieter') ? 7 : 0;
    var legH = (seated ? 4 : 10) - crouch / 2;
    var bodyZ = base + legH + (seated ? 0 : 0) + Math.abs(walk) * 1.2;
    var bodyColor = BODY[f.trade] || BODY.overig;
    var armL = 0, armR = 0;       // armen omhoog (beeldpunten)
    var idle = seated && !reduced ? Math.sin(tt * 1.3 + f.ph) * 0.8 : 0;

    if (v.moving) { armL = walk * 5; armR = -walk * 5; }
    var sw = (tt * 10 + f.ph);
    if (working) {
      if (f.trade === 'elektricien') { armR = 16 + Math.sin(tt * 4 + f.ph) * 5; armL = 8; }
      else if (f.trade === 'vloerlegger') { armR = 2 + Math.sin(tt * 2.2 + f.ph) * 5; armL = 2 + Math.cos(tt * 2.2 + f.ph) * 5; }
      else if (f.trade === 'schilder') { armR = 18 + Math.sin(tt * 2.6 + f.ph) * 6; armL = 4; }
      else if (f.trade === 'loodgieter') { armR = 4 + Math.abs(Math.sin(tt * 3 + f.ph)) * 6; armL = 4; }
      else if (f.trade === 'timmerman') { armR = 12 + Math.max(0, Math.sin(sw)) * 10; armL = 4; }
      else if (f.trade === 'overig') { armR = 14; armL = 14; }
    }

    // benen (met stapjes), lijf, armen, hoofd, helm
    var lift1 = v.moving && !reduced ? Math.max(0, walk) * 4 : 0, lift2 = v.moving && !reduced ? Math.max(0, -walk) * 4 : 0;
    var shoe = '#2B3640';
    kubus(x - 0.2, y - 0.07, base + lift1, 0.13, 0.14, legH, shoe);
    kubus(x + 0.07, y - 0.07, base + lift2, 0.13, 0.14, legH, shoe);
    kubus(x - 0.17, y - 0.11, bodyZ, 0.34, 0.22, 16, bodyColor);
    var topZ = bodyZ + 16;
    kubus(x - 0.28, y - 0.05, bodyZ + 3 + armL, 0.1, 0.1, 12, bodyColor);
    kubus(x + 0.18, y - 0.05, bodyZ + 3 + armR, 0.1, 0.1, 12, bodyColor);
    // gereedschap in de hand
    if (working) {
      var hz = bodyZ + 15 + armR, hx = x + 0.2;
      if (f.trade === 'timmerman') kubus(hx - 0.05, y - 0.05, hz, 0.1, 0.1, 9, C.dark);
      else if (f.trade === 'schilder') kubus(hx - 0.1, y - 0.1, hz, 0.3, 0.1, 5, '#6FA8DC');
      else if (f.trade === 'loodgieter') kubus(hx - 0.05, y - 0.05, hz, 0.08, 0.2, 4, C.grey);
      else if (f.trade === 'vloerlegger') kubus(hx - 0.1, y - 0.1, bodyZ + 3 + armR, 0.26, 0.26, 2, C.tileA);
      else if (f.trade === 'overig') kubus(x - 0.45, y - 0.07, topZ + 4, 0.9, 0.14, 3, C.wood);
      else if (f.trade === 'elektricien' && !reduced && Math.sin(tt * 14 + f.ph) > 0.55) kubus(hx - 0.05, y - 0.35, hz + 10, 0.1, 0.1, 5, C.yellow);
    }
    kubus(x - 0.13, y - 0.13 + idle * 0.01, topZ + idle, 0.26, 0.26, 12, C.skin);
    kubus(x - 0.16, y - 0.16 + idle * 0.01, topZ + 12 + idle, 0.32, 0.32, 5, f.color);
    ctx.restore();
  }

  // ---------- namen ----------
  function drawName(f, name, t, idx) {
    var v = visual(f, t);
    var p = iso(v.x, v.y, (f.state === 'bench' ? BENCH_H : 0) + 44 * FS);
    var sx = ox + p.sx * scale, sy = oy + p.sy * scale - 6;
    if (f.state === 'bench' && idx % 2) sy -= 14; // om en om hoger, zodat namen niet over elkaar vallen
    ctx.font = '700 12px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(name).width + 10;
    ctx.fillStyle = f.state === 'bench' ? 'rgba(255,255,255,.92)' : '#F2B705';
    var x0 = sx - w / 2, y0 = sy - 9, r = 6;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + w - r, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    ctx.lineTo(x0 + w, y0 + 18 - r); ctx.quadraticCurveTo(x0 + w, y0 + 18, x0 + w - r, y0 + 18);
    ctx.lineTo(x0 + r, y0 + 18); ctx.quadraticCurveTo(x0, y0 + 18, x0, y0 + 18 - r);
    ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#12202B';
    ctx.fillText(name, sx, sy);
  }

  // ---------- een beeld tekenen ----------
  function render() {
    if (!ctx || !cssW) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    drawGround();
    drawBackWalls();
    var items = props.slice();
    var t = reduced ? 0 : clock;
    list.forEach(function (e) {
      var f = figs[e.id];
      var v = visual(f, t);
      items.push({ depth: v.x + v.y, draw: function () { drawFigure(f, t); } });
    });
    items.sort(function (a, b) { return a.depth - b.depth; });
    for (var i = 0; i < items.length; i++) items[i].draw();
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var onBench = list.filter(function (e) { return figs[e.id].state === 'bench'; }).length;
    list.forEach(function (e, idx) {
      var f = figs[e.id];
      // een volle bank: alleen de beginletter, de hele naam staat in de lijst en in het scherm bij tikken
      var label = f.state === 'bench' && onBench > 6 ? e.name.charAt(0).toUpperCase() : e.name;
      drawName(f, label, t, idx);
    });
  }

  function step(dt) {
    list.forEach(function (e) {
      var f = figs[e.id];
      M.update(f, dt);
      if (f.moving) f.walkPhase += dt * 9;
    });
  }

  // ---------- maat en lus ----------
  function bounds() {
    var pts = [iso(SLAB.x0, SLAB.y1, -8), iso(SLAB.x1, SLAB.y0, -8), iso(SLAB.x0, SLAB.y0, WALL + 20), iso(SLAB.x1, SLAB.y1, -8)];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) { minX = Math.min(minX, p.sx); maxX = Math.max(maxX, p.sx); minY = Math.min(minY, p.sy); maxY = Math.max(maxY, p.sy); });
    return { minX: minX, maxX: maxX, minY: minY - 30, maxY: maxY + 6 };
  }
  function fit() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cssW = r.width; cssH = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var b = bounds(), bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    scale = Math.min(cssW / bw, cssH / bh);
    ox = cssW / 2 - (b.minX + bw / 2) * scale;
    oy = cssH / 2 - (b.minY + bh / 2) * scale;
    render();
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, (ts - lastT) / 1000) || 0;
    lastT = ts;
    clock += dt;
    step(dt);
    render();
  }
  function loopOn() {
    if (reduced || raf || document.hidden) return;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function loopOff() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function snapAll() {
    list.forEach(function (e) { M.update(figs[e.id], 1e6); });
  }

  // ---------- naar buiten ----------
  function setPeople(people) {
    layoutMap = M.layout(people);
    var seen = {};
    list = people.map(function (p, i) {
      seen[p.id] = true;
      var slot = layoutMap[p.id], f = figs[p.id];
      if (!f) {
        f = figs[p.id] = M.makeFigure(p, p.clockedIn, slot);
        f.ph = hashPhase(p.id); f.walkPhase = 0;
      } else {
        f.trade = p.trade;
        if (f.state === 'toWork' || f.state === 'toBench') M.update(f, 1e6);
        var home = f.state === 'working' ? slot.spot : slot.seat;
        f.x = home.x; f.y = home.y; // plek veranderd (iemand erbij of een ander beroep): geen gekke wandeling
        if ((f.state === 'working') !== !!p.clockedIn) {
          M.setClocked(f, !!p.clockedIn, slot);
          if (reduced) M.update(f, 1e6);
        }
      }
      return { id: p.id, name: p.name, idx: i };
    });
    Object.keys(figs).forEach(function (id) { if (!seen[id]) delete figs[id]; });
    render();
  }

  function hit(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var px = clientX - r.left, py = clientY - r.top, best = null, bestD = TAP_RADIUS;
    var t = reduced ? 0 : clock;
    list.forEach(function (e) {
      var f = figs[e.id], v = visual(f, t);
      var p = iso(v.x, v.y, (f.state === 'bench' ? BENCH_H : 0) + 24 * FS);
      var d = Math.hypot(ox + p.sx * scale - px, oy + p.sy * scale - py);
      if (d <= bestD) { bestD = d; best = e.id; }
    });
    return best;
  }

  function mount(el, onTap) {
    canvas = el; tapFn = onTap; ctx = canvas.getContext('2d');
    props = buildProps();
    mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    reduced = !!(mq && mq.matches);
    if (mq && mq.addEventListener) mq.addEventListener('change', function () {
      reduced = mq.matches;
      if (reduced) { loopOff(); snapAll(); render(); } else if (running) loopOn();
    });
    canvas.addEventListener('pointerup', function (ev) {
      var id = hit(ev.clientX, ev.clientY);
      if (id && tapFn) tapFn(id);
    });
    if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas); else window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) loopOff(); else if (running) loopOn();
    });
    fit();
  }
  function start() { running = true; fit(); if (reduced) { snapAll(); render(); } else loopOn(); }
  function stop() { running = false; loopOff(); }

  // _step en _hit zijn alleen voor testen: de animatie met de hand vooruit zetten, en tikken nabootsen
  function _step(dt) { clock += dt; step(dt); render(); }
  function _state() { return list.map(function (e) { var f = figs[e.id]; return e.name + ':' + f.state + '@' + f.x.toFixed(1) + ',' + f.y.toFixed(1) + ' path=' + f.path.length; }); }
  root.Scene = { mount: mount, setPeople: setPeople, start: start, stop: stop, _hit: hit, _step: _step, _state: _state };
})(typeof self !== 'undefined' ? self : this);
