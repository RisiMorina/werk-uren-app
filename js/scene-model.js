/* Werkvloer: de regels van de scene. Geen tekenen, geen DOM, dus testbaar in Node.
   Wereld in tegels. x loopt rechts-omlaag, y links-omlaag, z omhoog (isometrisch). */
(function (root) {
  'use strict';

  var TILE_W = 64, TILE_H = 32;

  var WORLD = {
    building: { x0: 0, y0: 0, x1: 8, y1: 6 },   // het half afgebouwde gebouw
    bench: { x0: 9.2, y0: 0.4, x1: 11.1, y1: 5.6 } // twee bankjes naast de rechtermuur
  };
  // Opening in de rechtermuur: buiten en binnen
  var DOOR_OUT = { x: 8.8, y: 3.0 };
  var DOOR_IN = { x: 7.4, y: 3.0 };

  function iso(x, y, z) {
    return { sx: (x - y) * TILE_W / 2, sy: (x + y) * TILE_H / 2 - z };
  }

  var TRADE_IDS = ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig'];
  function normTrade(t) { return TRADE_IDS.indexOf(t) >= 0 ? t : 'overig'; }

  // Eerste plek per beroep (x, y), richting waarin de volgende mensen staan (along),
  // en de rij daarachter (across). Alles ligt binnen het gebouw.
  var SPOTS = {
    elektricien: { x: 1.5, y: 0.8, ax: 1, ay: 0, bx: 0, by: 0.9 },    // bij de meterkast aan de achtermuur
    schilder:    { x: 0.8, y: 2.2, ax: 0, ay: 1, bx: 0.9, by: 0 },    // bij de witte muur links
    vloerlegger: { x: 4.5, y: 2.5, ax: 1, ay: 0, bx: 0, by: 0.9 },    // op de halve vloer
    loodgieter:  { x: 2.0, y: 5.0, ax: 1, ay: 0, bx: 0, by: -0.9 },   // bij de leidingen voor
    timmerman:   { x: 6.5, y: 0.9, ax: 0, ay: 1, bx: -0.9, by: 0 },   // bij het houten frame
    overig:      { x: 2.2, y: 3.4, ax: 0, ay: 0.7, bx: 1, by: 0 }     // bij de stapel planken
  };

  function workSpot(trade, index) {
    var s = SPOTS[normTrade(trade)];
    var i = ((index % 16) + 16) % 16;
    var along = i % 4, row = Math.floor(i / 4);
    return {
      x: s.x + s.ax * along + s.bx * row,
      y: s.y + s.ay * along + s.by * row
    };
  }

  function benchSeat(i) {
    var k = ((i % 16) + 16) % 16;
    return { x: k < 8 ? 9.55 : 10.75, y: 0.8 + (k % 8) * 0.65 };
  }

  // Zitplaats naar volgorde, werkplek naar volgorde binnen het beroep.
  function layout(people) {
    var out = {}, counts = {};
    people.forEach(function (p, i) {
      var t = normTrade(p.trade);
      var n = counts[t] || 0;
      counts[t] = n + 1;
      out[p.id] = { seat: benchSeat(i), spot: workSpot(t, n) };
    });
    return out;
  }

  function helmColor(id) {
    var h = 0, s = String(id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ',70%,50%)';
  }

  // Route langs de opening in de muur
  function route(from, to) {
    var inside = function (p) { return p.x < WORLD.building.x1; };
    var path = [];
    if (!inside(from) && inside(to)) {
      if (from.x > DOOR_OUT.x) path.push({ x: DOOR_OUT.x, y: DOOR_OUT.y });
      path.push({ x: DOOR_IN.x, y: DOOR_IN.y });
    } else if (inside(from) && !inside(to)) {
      if (from.x < DOOR_IN.x) path.push({ x: DOOR_IN.x, y: DOOR_IN.y });
      path.push({ x: DOOR_OUT.x, y: DOOR_OUT.y });
    }
    path.push({ x: to.x, y: to.y });
    return path;
  }

  function makeFigure(emp, clockedIn, slot) {
    var at = clockedIn ? slot.spot : slot.seat;
    return {
      id: emp.id, trade: normTrade(emp.trade), color: helmColor(emp.id),
      x: at.x, y: at.y, angle: 0, moving: false, path: [],
      state: clockedIn ? 'working' : 'bench'
    };
  }

  function setClocked(fig, clockedIn, slot) {
    if (clockedIn) {
      if (fig.state === 'working' || fig.state === 'toWork') return;
      fig.state = 'toWork';
      fig.path = route(fig, slot.spot);
    } else {
      if (fig.state === 'bench' || fig.state === 'toBench') return;
      fig.state = 'toBench';
      fig.path = route(fig, slot.seat);
    }
  }

  // Loopt langs het pad. Schiet nooit voorbij het doel.
  function update(fig, dt, speed) {
    var left = Math.max(0, dt) * (speed || 1.2);
    fig.moving = false;
    while (fig.path.length && left > 0) {
      var t = fig.path[0], dx = t.x - fig.x, dy = t.y - fig.y, d = Math.hypot(dx, dy);
      if (d <= left) {
        fig.x = t.x; fig.y = t.y; left -= d; fig.path.shift();
        if (d > 1e-9) { fig.moving = true; fig.angle = Math.atan2(dy, dx); }
      } else {
        fig.x += dx / d * left; fig.y += dy / d * left;
        fig.angle = Math.atan2(dy, dx); fig.moving = true; left = 0;
      }
    }
    if (!fig.path.length) {
      if (fig.state === 'toWork') { fig.state = 'working'; fig.moving = false; }
      else if (fig.state === 'toBench') { fig.state = 'bench'; fig.moving = false; }
    }
  }

  var api = {
    TILE_W: TILE_W, TILE_H: TILE_H, WORLD: WORLD, DOOR_OUT: DOOR_OUT, DOOR_IN: DOOR_IN,
    iso: iso, workSpot: workSpot, benchSeat: benchSeat, layout: layout, helmColor: helmColor,
    makeFigure: makeFigure, setClocked: setClocked, update: update
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SceneModel = api;
})(typeof self !== 'undefined' ? self : this);
