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

  // ---------- kijkrichting ----------
  function angleTo(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y;
    return Math.hypot(dx, dy) < 1e-6 ? 0 : Math.atan2(dy, dx);
  }
  // Waar kijkt iemand naar als hij staat te werken (hoek in de wereld, 0 = naar +x)
  function faceFor(trade, p) {
    if (trade === 'elektricien') return p.y < 2.5 ? -Math.PI / 2 : angleTo(p, { x: 2.5, y: 0.3 });   // meterkast aan de achtermuur
    if (trade === 'schilder') return p.x < 3 ? Math.PI : angleTo(p, { x: 0.3, y: 3.2 });             // witte muur links
    if (trade === 'timmerman') return Math.hypot(p.x - 6.85, p.y - 1.4) < 1.6 ? -Math.PI / 2 : angleTo(p, { x: 6.85, y: 1.4 }); // het frame
    if (trade === 'loodgieter') return p.y > 3.8 ? Math.PI / 2 : angleTo(p, { x: 4.5, y: 5.45 });    // leidingen voor
    if (trade === 'vloerlegger') return Math.PI;                                                       // naar het stuk vloer dat nog moet
    return angleTo(p, { x: 1.0, y: 4.0 });                                                             // overig: naar de planken
  }
  function restAngle(fig) {
    if (fig.state === 'bench' || fig.state === 'toBench') return Math.PI;  // op de bank kijk je naar het gebouw
    if (fig.lookAt && (fig.wanderPhase === 'out' || fig.wanderPhase === 'pause')) return angleTo(fig, fig.lookAt);
    return faceFor(fig.trade, fig);
  }

  // ---------- rondlopen ----------
  // Voorraad per beroep: waar loop je af en toe naartoe, en waar kijk je dan naar
  var SUPPLY = {
    elektricien: { x: 4.4, y: 1.45, look: { x: 4.4, y: 0.75 } },     // kabelhaspel
    vloerlegger: { x: 4.75, y: 2.3, look: { x: 3.9, y: 2.3 } },      // stapel tegels
    schilder: { x: 1.45, y: 1.3, look: { x: 1.45, y: 2.1 } },        // verfemmer
    loodgieter: { x: 2.2, y: 4.85, look: { x: 2.2, y: 5.45 } },      // gereedschap bij de leidingen
    timmerman: { x: 5.4, y: 1.6, look: { x: 6.2, y: 1.6 } },         // naar het frame
    overig: { x: 1.5, y: 4.8, look: { x: 1.5, y: 4.1 } }             // stapel planken
  };
  function inObstacle(p) {
    return OBSTACLES.some(function (r) { return p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1; });
  }
  function startTrip(fig, rand) {
    var spot = fig.slot.spot, target = null;
    if (rand() < 0.55) {
      var sp = SUPPLY[fig.trade] || SUPPLY.overig;
      target = { x: sp.x, y: sp.y };
      fig.lookAt = sp.look;
    } else {
      for (var k = 0; k < 6 && !target; k++) {
        var a = rand() * Math.PI * 2, r = 0.6 + rand() * 0.6;
        var c = {
          x: Math.min(7.6, Math.max(0.4, spot.x + Math.cos(a) * r)),
          y: Math.min(5.5, Math.max(0.4, spot.y + Math.sin(a) * r))
        };
        if (!inObstacle(c)) target = c;
      }
      fig.lookAt = null;
      if (!target) { var s2 = SUPPLY[fig.trade] || SUPPLY.overig; target = { x: s2.x, y: s2.y }; fig.lookAt = s2.look; }
    }
    fig.path = [target];
    fig.wanderPhase = 'out';
  }
  // Af en toe een stukje lopen en weer terug. Alleen als je aan het werk bent en stilstaat.
  function wander(fig, dt, rand) {
    rand = rand || Math.random;
    if (fig.state !== 'working' || !fig.slot) return;
    if (fig.wanderPhase === 'out') {
      if (!fig.path.length) { fig.wanderPhase = 'pause'; fig.pause = 1.5 + rand() * 2.5; }
      return;
    }
    if (fig.wanderPhase === 'pause') {
      fig.pause -= dt;
      if (fig.pause <= 0) { fig.path = [{ x: fig.slot.spot.x, y: fig.slot.spot.y }]; fig.wanderPhase = 'back'; fig.lookAt = null; }
      return;
    }
    if (fig.path.length) return;
    fig.idle -= dt;
    if (fig.idle <= 0) startTrip(fig, rand);
  }

  function makeFigure(emp, clockedIn, slot) {
    var at = clockedIn ? slot.spot : slot.seat;
    var fig = {
      id: emp.id, trade: normTrade(emp.trade), color: helmColor(emp.id), slot: slot,
      x: at.x, y: at.y, angle: 0, moving: false, path: [],
      state: clockedIn ? 'working' : 'bench',
      wanderPhase: null, lookAt: null, pause: 0, idle: 2 + Math.random() * 6
    };
    fig.angle = restAngle(fig);
    return fig;
  }

  function setClocked(fig, clockedIn, slot) {
    fig.slot = slot;
    if (clockedIn) {
      if (fig.state === 'working' || fig.state === 'toWork') return;
      fig.state = 'toWork';
      fig.wanderPhase = null; fig.lookAt = null;
      fig.path = route(fig, slot.spot);
    } else {
      if (fig.state === 'bench' || fig.state === 'toBench') return;
      fig.state = 'toBench';
      fig.wanderPhase = null; fig.lookAt = null;
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
      if (fig.state === 'toWork') { fig.state = 'working'; fig.moving = false; fig.idle = 2 + Math.random() * 6; }
      else if (fig.state === 'toBench') { fig.state = 'bench'; fig.moving = false; }
      if (fig.wanderPhase === 'back') { fig.wanderPhase = null; fig.idle = 3 + Math.random() * 6; }
    }
    if (!fig.moving) fig.angle = restAngle(fig);
  }

  var api = {
    TILE_W: TILE_W, TILE_H: TILE_H, WORLD: WORLD, DOOR_OUT: DOOR_OUT, DOOR_IN: DOOR_IN,
    iso: iso, SPOT_POOL: SPOT_POOL, HOME: HOME, OBSTACLES: OBSTACLES, benchSeat: benchSeat, layout: layout, helmColor: helmColor,
    makeFigure: makeFigure, setClocked: setClocked, update: update, wander: wander, restAngle: restAngle, SUPPLY: SUPPLY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SceneModel = api;
})(typeof self !== 'undefined' ? self : this);
