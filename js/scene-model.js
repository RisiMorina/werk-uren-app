/* Werkvloer: de regels van de scene. Geen tekenen, geen DOM, dus testbaar in Node.
   Wereld in tegels. x loopt rechts-omlaag, y links-omlaag, z omhoog (isometrisch). */
(function (root) {
  'use strict';

  var TILE_W = 64, TILE_H = 44;

  var WORLD = {
    building: { x0: 0, y0: 0, x1: 8, y1: 6 },   // het half afgebouwde gebouw
    bench: { x0: 9.2, y0: 0.4, x1: 11.1, y1: 7.6 } // twee bankjes naast de rechtermuur
  };
  // Opening in de rechtermuur: buiten en binnen
  var DOOR_OUT = { x: 8.8, y: 3.0 };
  var DOOR_IN = { x: 7.4, y: 3.0 };

  function iso(x, y, z) {
    return { sx: (x - y) * TILE_W / 2, sy: (x + y) * TILE_H / 2 - z };
  }

  var TRADE_IDS = ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig'];
  function normTrade(t) { return TRADE_IDS.indexOf(t) >= 0 ? t : 'overig'; }

  // 16 werkplekken in het gebouw, minstens 1,2 tegel uit elkaar en niet in of op een voorwerp.
  // Iedereen pakt de vrije plek die het dichtst bij zijn eigen hoek van het gebouw ligt,
  // dus elke mix van beroepen past zonder dat poppetjes door elkaar lopen.
  var SPOT_POOL = [
    { x: 1.3, y: 0.9 }, { x: 2.7, y: 0.9 }, { x: 5.3, y: 0.9 }, { x: 6.85, y: 1.4 },
    { x: 0.95, y: 2.3 }, { x: 2.6, y: 2.3 }, { x: 5.0, y: 2.3 },
    { x: 3.0, y: 3.6 }, { x: 4.4, y: 3.6 }, { x: 5.8, y: 3.6 }, { x: 7.2, y: 3.6 },
    { x: 3.2, y: 4.8 }, { x: 4.7, y: 4.8 }, { x: 6.0, y: 4.8 }, { x: 7.3, y: 4.8 },
    { x: 0.95, y: 4.9 }
  ];
  // Eigen hoek per beroep: meterkast, halve vloer, witte muur, leidingen, houten frame, plankenstapel
  var HOME = {
    elektricien: { x: 2.7, y: 0.9 }, vloerlegger: { x: 5.0, y: 2.3 }, schilder: { x: 0.95, y: 2.3 },
    loodgieter: { x: 4.7, y: 4.8 }, timmerman: { x: 6.85, y: 1.4 }, overig: { x: 3.0, y: 3.6 }
  };
  // De voorwerpen uit scene.js (met 0,3 tegel marge), zodat een test kan nagaan dat niemand erin staat.
  var OBSTACLES = [
    { x0: 3.9, y0: 0.25, x1: 4.9, y1: 1.25 },    // kabelhaspel
    { x0: 5.9, y0: 0.3, x1: 6.65, y1: 1.05 }, { x0: 7.2, y0: 0.3, x1: 7.95, y1: 1.05 },   // palen van het frame
    { x0: 5.9, y0: 1.8, x1: 6.65, y1: 2.55 }, { x0: 7.2, y0: 1.8, x1: 7.95, y1: 2.55 },
    { x0: 1.2, y0: 5.1, x1: 7.8, y1: 5.84 },     // leidingen
    { x0: 0.8, y0: 3.6, x1: 2.2, y1: 4.45 },     // planken
    { x0: 3.4, y0: 1.8, x1: 4.35, y1: 2.75 },    // tegels
    { x0: 1.05, y0: 1.7, x1: 1.87, y1: 2.52 }    // verfemmer
  ];

  function benchSeat(i) {
    var k = ((i % 16) + 16) % 16;
    return { x: k < 8 ? 9.55 : 10.75, y: 0.8 + (k % 8) * 0.9 };
  }

  // Zitplaats naar volgorde, werkplek naar de dichtstbijzijnde vrije plek bij het eigen beroep.
  function layout(people) {
    var out = {}, free = SPOT_POOL.slice();
    people.forEach(function (p, i) {
      if (!free.length) free = SPOT_POOL.slice(); // meer dan 16 mensen: plekken worden gedeeld
      var home = HOME[normTrade(p.trade)], best = 0, bestD = Infinity;
      free.forEach(function (s, k) {
        var d = Math.hypot(s.x - home.x, s.y - home.y);
        if (d < bestD - 1e-9) { bestD = d; best = k; }
      });
      out[p.id] = { seat: benchSeat(i), spot: free.splice(best, 1)[0] };
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
    iso: iso, SPOT_POOL: SPOT_POOL, HOME: HOME, OBSTACLES: OBSTACLES, benchSeat: benchSeat, layout: layout, helmColor: helmColor,
    makeFigure: makeFigure, setClocked: setClocked, update: update
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SceneModel = api;
})(typeof self !== 'undefined' ? self : this);
