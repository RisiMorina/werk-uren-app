/* Werkvloer: tekent de scene op een canvas. Alles is gebouwd van blokjes (kubus() en boxR()).
   De regels (plekken, lopen, kijkrichting, rondlopen) staan in scene-model.js.
   Gebruik: Scene.mount(canvas, onTap); Scene.setPeople(lijst); Scene.start(); Scene.stop(); */
(function (root) {
  'use strict';
  var M = root.SceneModel;
  var iso = M.iso;

  var WALL = 84;        // hoogte van de twee achtermuren (beeldpunten)
  var LOW = 14;         // hoogte van de lage voor- en zijmuur
  var BENCH_H = 10;     // zithoogte van het bankje
  var TAP_RADIUS = 32;  // tikzone rond een poppetje, in schermpunten
  var FS = 1.7;         // poppetjes zijn zo veel keer groter getekend dan hun tegels
  var SLAB = { x0: -0.6, y0: -0.6, x1: 11.9, y1: 8.2 };

  var C = {
    grass: '#98B684', pad: '#C2C8CC', floor: '#A9B1B7', brick: '#B5543C', white: '#F3F3F0',
    tileA: '#E6B85C', tileB: '#D49A3A', wood: '#C98F4B', woodDark: '#A06F34', bench: '#8A5E38',
    copper: '#D08A3B', blue: '#1B4F8F', yellow: '#F2B705', grey: '#8A97A1', dark: '#33414D', skin: '#E8B98F',
    glass: '#7FA3BF', jeans: '#3B4A5A', boot: '#2B3640'
  };
  var BODY = { elektricien: '#E8A317', vloerlegger: '#C8642B', schilder: '#F1F1EE', loodgieter: '#2E5C99', timmerman: '#4B7F52', overig: '#6F7C88' };

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
  // Eén blok langs de assen: x, y in tegels, z en h in beeldpunten, w en d in tegels. Drie zichtbare vlakken.
  function kubus(x, y, z, w, d, h, color) {
    var a = iso(x, y, z + h), b = iso(x + w, y, z + h), c = iso(x + w, y + d, z + h), e = iso(x, y + d, z + h);
    poly([a, b, c, e], shade(color, 0.18));
    if (h > 0) {
      poly([e, c, iso(x + w, y + d, z), iso(x, y + d, z)], color);
      poly([b, c, iso(x + w, y + d, z), iso(x + w, y, z)], shade(color, -0.22));
    }
  }
  function vlak(x, y, z, w, d, color) { kubus(x, y, z, w, d, 0, color); }
  function lijn(x0, y0, z0, x1, y1, z1, color, width) {
    var a = iso(x0, y0, z0), b = iso(x1, y1, z1);
    ctx.strokeStyle = color; ctx.lineWidth = width || 1;
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
  }

  // Blok dat meedraait met een hoek. cx, cy: midden in tegels; w loopt in de kijkrichting, d dwars erop.
  function boxR(cx, cy, z, w, d, h, ang, color) {
    var ca = Math.cos(ang), sa = Math.sin(ang), hw = w / 2, hd = d / 2;
    var q = [[hw, hd], [hw, -hd], [-hw, -hd], [-hw, hd]].map(function (p) {
      return { x: cx + p[0] * ca - p[1] * sa, y: cy + p[0] * sa + p[1] * ca };
    });
    var normals = [[ca, sa], [sa, -ca], [-ca, -sa], [-sa, ca]];
    var faces = [];
    for (var i = 0; i < 4; i++) {
      var k = normals[i][0] + normals[i][1];
      if (k > 0.0001) faces.push({ i: i, k: k, s: (normals[i][0] - normals[i][1]) / 1.4142 });
    }
    faces.sort(function (a, b) { return a.k - b.k; });
    faces.forEach(function (f) {
      var p0 = q[f.i], p1 = q[(f.i + 1) % 4];
      poly([iso(p0.x, p0.y, z + h), iso(p1.x, p1.y, z + h), iso(p1.x, p1.y, z), iso(p0.x, p0.y, z)], shade(color, -0.11 - 0.22 * f.s));
    });
    poly(q.map(function (p) { return iso(p.x, p.y, z + h); }), shade(color, 0.16));
  }

  // ---------- vaste dingen: achtergrond ----------
  function drawGround() {
    // het terrein als een plaat (gras), met een betonnen plek om het gebouw en onder de bankjes
    kubus(SLAB.x0, SLAB.y0, -8, SLAB.x1 - SLAB.x0, SLAB.y1 - SLAB.y0, 8, C.grass);
    vlak(-0.4, -0.4, 0, 8.8, 6.8, C.pad);
    vlak(8.9, 0.1, 0, 2.7, 7.9, C.pad);
    // vloer van het gebouw met voegen
    kubus(0, 0, 0, 8, 6, 2, C.floor);
    var i, j;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) vlak(4 + i, 2 + j, 2, 1, 1, (i + j) % 2 ? C.tileA : C.tileB);
    for (i = 0; i <= 8; i++) lijn(i, 0.3, 2, i, 6, 2, 'rgba(0,0,0,.07)', 1);
    for (j = 0; j <= 6; j++) lijn(0.3, j, 2, 8, j, 2, 'rgba(0,0,0,.07)', 1);
  }
  function drawBackWalls() {
    // achtermuur (y = 0) en linkermuur (x = 0) met baksteenvoegen
    kubus(0, 0, 2, 8, 0.3, WALL, C.brick);
    kubus(0, 0, 2, 0.3, 6, WALL, C.brick);
    var z;
    for (z = 11; z < WALL; z += 9) {
      lijn(0.3, 0.3, z, 8, 0.3, z, 'rgba(255,255,255,.16)', 1);
      lijn(0.3, 0.3, z, 0.3, 6, z, 'rgba(255,255,255,.16)', 1);
    }
    // ramen
    kubus(3.9, 0.3, 34, 1.3, 0.05, 34, C.glass);
    kubus(3.85, 0.3, 31, 1.4, 0.1, 3, C.white); kubus(3.85, 0.3, 68, 1.4, 0.1, 3, C.white);
    kubus(4.52, 0.3, 34, 0.06, 0.08, 34, C.white);
    kubus(0.3, 0.55, 34, 0.05, 0.8, 34, C.glass);
    kubus(0.3, 0.5, 31, 0.1, 0.9, 3, C.white); kubus(0.3, 0.5, 68, 0.1, 0.9, 3, C.white);
    // meterkast met een geel strookje, en draden boven het raam langs
    kubus(1.7, 0.3, 24, 1.5, 0.12, 40, C.grey);
    kubus(1.85, 0.42, 52, 0.5, 0.04, 8, C.yellow);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 2;
    var w1 = iso(3.2, 0.42, 48), w2 = iso(3.6, 0.42, 76), w3 = iso(7.4, 0.42, 76), w4 = iso(7.4, 0.42, 36);
    ctx.beginPath(); ctx.moveTo(w1.sx, w1.sy); ctx.lineTo(w2.sx, w2.sy); ctx.lineTo(w3.sx, w3.sy); ctx.lineTo(w4.sx, w4.sy); ctx.stroke();
    // linkermuur: een stuk wit geschilderd
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
    for (i = 0; i < 2; i++) box(6.2 + i * 1.3, 0.6, 76, 0.15, 1.65, 7, C.woodDark);
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
    // bankjes: per zitplaats een stukje (plank op twee poten), zodat poppetjes goed sorteren
    for (i = 0; i < 16; i++) {
      var s = M.benchSeat(i);
      box(s.x - 0.22, s.y - 0.4, 0, 0.07, 0.8, BENCH_H - 3, C.woodDark);           // poot
      p[p.length - 1].depth -= 0.06;
      box(s.x - 0.25, s.y - 0.45, BENCH_H - 3, 0.5, 0.9, 3, C.bench);              // zitplank
      p[p.length - 1].depth -= 0.05;
    }
    return p;
  }

  // ---------- poppetjes ----------
  function hashPhase(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return (h % 628) / 100; }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function visual(f) { return { x: f.x, y: f.y, moving: f.moving }; }

  // Een poppetje is een stapeltje blokken dat meedraait met zijn kijkrichting (f.da).
  function drawFigure(f, t) {
    var foot = iso(f.x, f.y, 0);
    ctx.save();
    ctx.translate(foot.sx, foot.sy);
    ctx.scale(FS, FS);
    var ang = reduced ? f.angle : f.da, ca = Math.cos(ang), sa = Math.sin(ang);
    var tt = reduced ? 0 : t, ph = f.ph;
    var moving = f.moving && !reduced;
    var seated = f.state === 'bench', working = f.state === 'working';
    var pose = working && (!moving || f.trade === 'overig');   // aan het werk (overig draagt ook lopend een plank)
    var walk = moving ? Math.sin(f.walkPhase) : 0;
    var base = seated ? BENCH_H / FS : 0;
    var body = BODY[f.trade] || BODY.overig;
    var crouch = pose && !moving ? (f.trade === 'vloerlegger' ? 5 : f.trade === 'loodgieter' ? 3 : 0) : 0;
    var legH = seated ? 0 : 11 - crouch;
    var hip = base + legH;
    var lean = crouch ? 0.07 : 0;
    var parts = [];
    function at(u, s) { return { x: u * ca - s * sa, y: u * sa + s * ca }; }
    function part(u, s, z, w, d, h, color, extra) {
      var p = at(u, s);
      parts.push({ k: p.x + p.y + z * 0.004, draw: function () { boxR(p.x, p.y, z, w, d, h, ang + (extra || 0), color); } });
    }

    // zachte schaduw op de grond (of op de bank)
    var sh = [];
    for (var a = 0; a < 10; a++) sh.push(iso(Math.cos(a * 0.628) * 0.3, Math.sin(a * 0.628) * 0.3, base));
    poly(sh, 'rgba(20,30,40,.2)');

    // benen
    [-1, 1].forEach(function (sd) {
      if (seated) {
        part(0.1, sd * 0.085, base, 0.22, 0.12, 5, C.jeans);          // bovenbeen naar voren
        part(0.2, sd * 0.085, 0, 0.12, 0.12, base + 3, C.jeans);      // onderbeen naar beneden
        part(0.23, sd * 0.085, 0, 0.17, 0.13, 2.5, C.boot);
      } else {
        var sw = walk * sd, lift = Math.max(0, sw) * 2.5;
        part(sw * 0.14, sd * 0.085, lift + 3, 0.12, 0.12, legH - 3, C.jeans);
        part(sw * 0.14 + 0.02, sd * 0.085, lift, 0.17, 0.13, 3, C.boot);
      }
    });

    // lijf met een reflecterend strookje
    var tu = seated ? -0.02 : lean;
    part(tu, 0, hip, 0.2, 0.32, 15, body);
    part(tu, 0, hip + 6, 0.215, 0.335, 3, body === '#E8A317' ? '#F2F2F2' : C.yellow);

    // armen: hangend (met zwaai), of naar het werk gestrekt
    var shoulder = hip + 12;
    var poses = null;
    if (pose) {
      var strike = Math.max(0, Math.sin(tt * 3.2 + ph));
      if (f.trade === 'elektricien') poses = [{ L: 0.28, lift: 2 }, { L: 0.36, lift: 5 + 3 * Math.sin(tt * 1.6 + ph) }];
      else if (f.trade === 'schilder') poses = [null, { L: 0.38, lift: 3 + 8 * Math.sin(tt * 1.4 + ph) }];
      else if (f.trade === 'vloerlegger') poses = [{ L: 0.26 + 0.08 * Math.sin(tt * 1.8 + ph), lift: -7 }, { L: 0.26 + 0.08 * Math.sin(tt * 1.8 + ph), lift: -7 }];
      else if (f.trade === 'loodgieter') poses = [{ L: 0.25, lift: -1 }, { L: 0.3, lift: -3 }];
      else if (f.trade === 'timmerman') poses = [{ L: 0.28, lift: 1 }, { L: 0.18, lift: 3 + 9 * strike }];
      else poses = [{ L: 0.1, lift: 10 }, { L: 0.1, lift: 10 }];   // overig houdt een plank vast
    }
    [-1, 1].forEach(function (sd, idx) {
      var spec = poses && poses[idx];
      var s = sd * 0.2;
      if (spec) {
        var z = shoulder + spec.lift - 5;
        part(tu + spec.L / 2 + 0.05, s, z, spec.L, 0.09, 5, body);
        part(tu + spec.L + 0.07, s, z, 0.09, 0.09, 5, C.skin);
      } else {
        var u = -walk * sd * 0.13 + tu;
        part(u, s, shoulder - 11, 0.09, 0.09, 11, body);
        part(u, s, shoulder - 13.5, 0.09, 0.09, 3, C.skin);
      }
    });

    // gereedschap in de hand, alleen als je aan het werk staat
    if (pose) {
      var tip = poses[1] ? poses[1].L : 0.3, tz = shoulder + (poses[1] ? poses[1].lift : 0) - 5;
      if (f.trade === 'timmerman') {
        part(tu + tip + 0.1, 0.2, tz - 2, 0.05, 0.05, 9, C.wood);
        part(tu + tip + 0.1, 0.2, tz + 7, 0.05, 0.14, 3, C.dark);
      } else if (f.trade === 'schilder') {
        part(tu + tip + 0.1, 0.2, tz - 3, 0.06, 0.06, 10, '#6FA8DC');
      } else if (f.trade === 'loodgieter') {
        part(tu + tip + 0.1, 0.2, tz, 0.2, 0.05, 2, C.grey, reduced ? 0 : Math.sin(tt * 2.2 + ph) * 0.7);
      } else if (f.trade === 'vloerlegger') {
        part(tu + 0.3, 0, shoulder - 13, 0.22, 0.22, 2, C.tileA);
      } else if (f.trade === 'elektricien') {
        if (!reduced && Math.sin(tt * 9 + ph) > 0.55) part(tu + tip + 0.12, 0.2, tz + 3, 0.07, 0.07, 5, C.yellow);
      } else {
        part(tu + 0.02, 0.0, hip + 17, 0.95, 0.12, 2.5, C.wood);   // plank
      }
    }

    // hoofd met ogen, helm met rand
    var hu = seated ? -0.02 : lean + (crouch ? 0.04 : 0);
    var hz = hip + 15;
    part(hu, 0, hz, 0.2, 0.2, 10, C.skin);
    part(hu + 0.105, -0.05, hz + 5.5, 0.02, 0.04, 2.2, C.dark);
    part(hu + 0.105, 0.05, hz + 5.5, 0.02, 0.04, 2.2, C.dark);
    part(hu, 0, hz + 10, 0.27, 0.27, 4, f.color);
    part(hu + 0.17, 0, hz + 10, 0.1, 0.22, 1.6, shade(f.color, -0.2));

    parts.sort(function (p, q) { return p.k - q.k; });
    for (var i = 0; i < parts.length; i++) parts[i].draw();
    ctx.restore();
  }

  // ---------- namen ----------
  function pill(x0, y0, w, h, fill) {
    var r = 6;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + w - r, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    ctx.lineTo(x0 + w, y0 + h - r); ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    ctx.lineTo(x0 + r, y0 + h); ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
    ctx.closePath(); ctx.fill();
  }
  var FONT = '700 12px system-ui, -apple-system, "Segoe UI", sans-serif';
  var NUDGE = [0, -19, -38, -57]; // botst een naam, dan schuift hij omhoog

  // Naam boven elk poppetje dat niet op de bank zit. Voorste poppetjes eerst, achterste schuiven op.
  function drawNames() {
    var taken = [];
    ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var shown = list.filter(function (e) { return figs[e.id].state !== 'bench'; }).map(function (e) {
      var v = visual(figs[e.id]);
      return { e: e, v: v, depth: v.x + v.y };
    }).sort(function (a, b) { return b.depth - a.depth; });
    shown.forEach(function (it) {
      var p = iso(it.v.x, it.v.y, 41 * FS);
      var sx = ox + p.sx * scale, sy = oy + p.sy * scale - 6;
      var w = ctx.measureText(it.e.name).width + 10, rect = null;
      for (var k = 0; k < NUDGE.length; k++) {
        rect = { x0: sx - w / 2, y0: sy + NUDGE[k] - 9, x1: sx + w / 2, y1: sy + NUDGE[k] + 9, cy: sy + NUDGE[k] };
        var clash = taken.some(function (r) { return rect.x0 < r.x1 && rect.x1 > r.x0 && rect.y0 < r.y1 && rect.y1 > r.y0; });
        if (!clash) break;
      }
      taken.push(rect);
      pill(rect.x0, rect.y0, w, 18, '#F2B705');
      ctx.fillStyle = '#12202B';
      ctx.fillText(it.e.name, sx, rect.cy);
    });
  }

  // Wie er op de bank zit staat in een label links onder, zodat namen op de bank niet over elkaar vallen.
  function drawBenchSummary() {
    var names = list.filter(function (e) { return figs[e.id].state === 'bench'; }).map(function (e) { return e.name; });
    if (!names.length) return;
    ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var maxW = Math.min(cssW * 0.5, 230);
    var tokens = ['Op', 'de', 'bank:'].concat(names.map(function (n, i) { return n + (i < names.length - 1 ? ',' : ''); }));
    var lines = [], line = '';
    tokens.forEach(function (tk) {
      var tryLine = line ? line + ' ' + tk : tk;
      if (line && ctx.measureText(tryLine).width > maxW - 14) { lines.push(line); line = tk; } else line = tryLine;
    });
    lines.push(line);
    if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/,?$/, '') + ' ...'; }
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    w += 14;
    var h = lines.length * 16 + 8, x0 = 8, y0 = cssH - 8 - h;
    pill(x0, y0, w, h, 'rgba(255,255,255,.94)');
    ctx.fillStyle = '#12202B';
    lines.forEach(function (l, i) { ctx.fillText(l, x0 + 7, y0 + 4 + 8 + i * 16); });
  }

  // ---------- een beeld tekenen ----------
  function render() {
    if (!ctx || !cssW) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, '#D6E4EE'); g.addColorStop(1, '#EEF3F6');
    ctx.fillStyle = g;
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
      items.push({ depth: f.x + f.y, draw: function () { drawFigure(f, t); } });
    });
    items.sort(function (a, b) { return a.depth - b.depth; });
    for (var i = 0; i < items.length; i++) items[i].draw();
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawNames();
    drawBenchSummary();
  }

  function step(dt) {
    list.forEach(function (e) {
      var f = figs[e.id];
      if (!reduced) M.wander(f, dt);
      M.update(f, dt);
      if (f.moving) f.walkPhase += dt * 9;
      // vloeiend omdraaien
      f.da = reduced ? f.angle : wrapPi(f.da + wrapPi(f.angle - f.da) * Math.min(1, dt * 9));
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
    list.forEach(function (e) {
      var f = figs[e.id];
      f.path = []; f.wanderPhase = null; f.lookAt = null;
      M.update(f, 1e6);
      f.da = f.angle;
    });
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
        f.ph = hashPhase(p.id); f.walkPhase = 0; f.da = f.angle;
      } else {
        var prev = f.slot;
        var moved = !prev || prev.spot.x !== slot.spot.x || prev.spot.y !== slot.spot.y || prev.seat.x !== slot.seat.x || prev.seat.y !== slot.seat.y;
        f.trade = p.trade;
        if (moved) {
          // plek veranderd (iemand erbij of een ander beroep): meteen naar de nieuwe plek, geen gekke wandeling
          f.slot = slot;
          f.path = []; f.wanderPhase = null; f.lookAt = null;
          if (f.state === 'toWork') f.state = 'working';
          if (f.state === 'toBench') f.state = 'bench';
          var home = f.state === 'working' ? slot.spot : slot.seat;
          f.x = home.x; f.y = home.y;
        }
        var isWorking = f.state === 'working' || f.state === 'toWork';
        if (isWorking !== !!p.clockedIn) {
          M.setClocked(f, !!p.clockedIn, slot);
          if (reduced) { M.update(f, 1e6); f.da = f.angle; }
        } else if (reduced) f.da = f.angle;
      }
      return { id: p.id, name: p.name, idx: i };
    });
    Object.keys(figs).forEach(function (id) { if (!seen[id]) delete figs[id]; });
    render();
  }

  function hit(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var px = clientX - r.left, py = clientY - r.top, best = null, bestD = TAP_RADIUS;
    list.forEach(function (e) {
      var f = figs[e.id];
      var p = iso(f.x, f.y, (f.state === 'bench' ? BENCH_H : 0) + 22 * FS);
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

  // _step, _hit en _state zijn alleen voor testen: de animatie met de hand vooruit zetten, tikken nabootsen
  function _step(dt) { clock += dt; step(dt); render(); }
  function _state() { return list.map(function (e) { var f = figs[e.id]; return e.name + ':' + f.state + '@' + f.x.toFixed(1) + ',' + f.y.toFixed(1) + ' path=' + f.path.length + ' phase=' + f.wanderPhase + ' angle=' + f.angle.toFixed(2); }); }
  root.Scene = { mount: mount, setPeople: setPeople, start: start, stop: stop, _hit: hit, _step: _step, _state: _state };
})(typeof self !== 'undefined' ? self : this);
