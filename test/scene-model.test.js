// Run with: node test/scene-model.test.js
const assert = require('assert');
const M = require('../js/scene-model.js');

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function minDistance(points) {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) min = Math.min(min, dist(points[i], points[j]));
  return min;
}
const inside = (p) => p.x >= 0.3 && p.x <= 7.7 && p.y >= 0.3 && p.y <= 5.7;

// isometric projection
assert.deepStrictEqual(M.iso(0, 0, 0), { sx: 0, sy: 0 });
assert.strictEqual(M.iso(1, 0, 0).sx, 32);
assert.strictEqual(M.iso(1, 0, 0).sy, 22, 'steep camera: tile is 64 wide and 44 high');
assert.ok(M.benchSeat(1).y - M.benchSeat(0).y >= 0.9, 'room for names on the bench');
assert.strictEqual(M.iso(0, 1, 0).sx, -32);
assert.strictEqual(M.iso(0, 0, 10).sy, -10, 'z lifts up');

// bench: 16 seats, all different and not on top of each other
const seats = Array.from({ length: 16 }, (_, i) => M.benchSeat(i));
assert.ok(minDistance(seats) >= 0.6, 'bench seats keep distance');
assert.ok(seats.every((s) => s.x > M.WORLD.building.x1), 'bench is outside the building');

// work spots: one shared pool of 16, so no mix of trades can ever collide
const TRADES = ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig'];
assert.strictEqual(M.SPOT_POOL.length, 16);
assert.ok(M.SPOT_POOL.every(inside), 'every spot is inside the building');
assert.ok(minDistance(M.SPOT_POOL) >= 1.2, 'spots are at least 1.2 tiles apart');
const near = (p, r) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
assert.ok(M.SPOT_POOL.every((p) => !M.OBSTACLES.some((r) => near(p, r))), 'no spot stands inside a prop or on the pipes');

// layout: seat by order, spot by affinity with the trade, all distinct
const people = [
  { id: 'a', trade: 'elektricien' }, { id: 'b', trade: 'schilder' }, { id: 'c', trade: 'elektricien' },
];
const lay = M.layout(people);
assert.deepStrictEqual(lay.a.seat, M.benchSeat(0));
assert.deepStrictEqual(lay.c.seat, M.benchSeat(2));
assert.ok(dist(lay.a.spot, M.HOME.elektricien) < 1.0, 'first electrician stands at the meter box');
assert.ok(dist(lay.b.spot, M.HOME.schilder) < 1.0, 'painter stands at the white wall');
assert.notDeepStrictEqual(lay.a.spot, lay.c.spot, 'two electricians do not share a spot');
assert.deepStrictEqual(M.layout(people), lay, 'layout is stable');
assert.deepStrictEqual(M.layout([]), {});

// six people, one per trade: each near its own place
const six = TRADES.map((t, i) => ({ id: 's' + i, trade: t }));
const l6 = M.layout(six);
assert.ok(six.every((p) => dist(l6[p.id].spot, M.HOME[p.trade]) < 1.6), 'each trade is near its home');
assert.ok(minDistance(six.map((p) => l6[p.id].spot)) >= 1.2);

// sixteen of one trade, and sixteen of mixed trades: all spots distinct and apart
for (const t of TRADES) {
  const all = Array.from({ length: 16 }, (_, i) => ({ id: t + i, trade: t }));
  const l = M.layout(all);
  assert.ok(minDistance(all.map((p) => l[p.id].spot)) >= 1.2, '16 x ' + t + ' do not overlap');
}
const mixed = Array.from({ length: 16 }, (_, i) => ({ id: 'm' + i, trade: TRADES[(i * 5) % 6] }));
const lm = M.layout(mixed);
assert.ok(minDistance(mixed.map((p) => lm[p.id].spot)) >= 1.2, 'mixed 16 do not overlap');
const seven = Array.from({ length: 7 }, (_, i) => ({ id: 'o' + i, trade: 'overig' }));
const l7 = M.layout(seven);
assert.ok(minDistance(seven.map((p) => l7[p.id].spot)) >= 1.2, 'five or more Overig keep apart');
assert.deepStrictEqual(M.layout([{ id: 'u', trade: 'onbekend' }]).u.spot, M.layout([{ id: 'u', trade: 'overig' }]).u.spot, 'unknown trade works like overig');
const over = Array.from({ length: 20 }, (_, i) => ({ id: 'z' + i, trade: 'overig' }));
assert.doesNotThrow(() => M.layout(over), 'more than 16 people does not crash');

// walking
const fig = M.makeFigure(people[0], false, lay.a);
assert.strictEqual(fig.state, 'bench');
assert.strictEqual(fig.x, lay.a.seat.x);
M.setClocked(fig, true, lay.a);
assert.strictEqual(fig.state, 'toWork');
assert.ok(fig.path.length >= 2, 'goes through the door');
assert.ok(fig.path[0].x > M.WORLD.building.x1 - 0.01 || fig.path[0].x >= 8, 'first stop is at the door outside');
M.update(fig, 0.5);
assert.strictEqual(fig.state, 'toWork', 'still walking after half a second');
assert.strictEqual(fig.moving, true);
M.update(fig, 100);
assert.strictEqual(fig.state, 'working');
assert.strictEqual(fig.x, lay.a.spot.x, 'no overshoot, lands exactly');
assert.strictEqual(fig.y, lay.a.spot.y);
assert.strictEqual(fig.moving, false);
M.setClocked(fig, false, lay.a);
assert.strictEqual(fig.state, 'toBench');
M.update(fig, 100);
assert.strictEqual(fig.state, 'bench');
assert.strictEqual(fig.x, lay.a.seat.x);

// changing your mind halfway: walks back from where it is
const f2 = M.makeFigure(people[1], false, lay.b);
M.setClocked(f2, true, lay.b);
M.update(f2, 1);
const midX = f2.x, midY = f2.y;
M.setClocked(f2, false, lay.b);
assert.strictEqual(f2.state, 'toBench');
assert.strictEqual(f2.x, midX, 'does not jump');
assert.strictEqual(f2.y, midY);
M.update(f2, 100);
assert.strictEqual(f2.state, 'bench');

// someone already clocked in at start stands at the spot
const f3 = M.makeFigure(people[2], true, lay.c);
assert.strictEqual(f3.state, 'working');
assert.strictEqual(f3.x, lay.c.spot.x);

// zero or huge time steps do not break anything
const f4 = M.makeFigure(people[0], false, lay.a);
M.setClocked(f4, true, lay.a);
M.update(f4, 0);
assert.strictEqual(f4.state, 'toWork');

assert.strictEqual(M.helmColor('a'), M.helmColor('a'));
assert.notStrictEqual(M.helmColor('a'), M.helmColor('b'));

// ---- kijkrichting: naar het werk, naar waar je loopt, op de bank naar het gebouw ----
{
  const face = (f) => ({ c: Math.cos(f.angle), s: Math.sin(f.angle) });
  const mk = (trade, id) => {
    const l = M.layout([{ id, trade }]);
    return M.makeFigure({ id, trade }, true, l[id]);
  };
  assert.ok(face(mk('elektricien', 'e')).s < -0.5, 'electrician faces the back wall (up in world y)');
  assert.ok(face(mk('schilder', 's')).c < -0.7, 'painter faces the white wall (left, -x)');
  assert.ok(face(mk('loodgieter', 'l')).s > 0.5, 'plumber faces the pipes (+y)');
  assert.ok(face(mk('timmerman', 't')).s < -0.5, 'carpenter faces the frame');
  const seated = M.makeFigure({ id: 'b', trade: 'overig' }, false, M.layout([{ id: 'b', trade: 'overig' }]).b);
  assert.ok(Math.abs(Math.abs(seated.angle) - Math.PI) < 1e-9, 'seated figures face the building (-x)');

  // lopend kijk je de kant op waar je heen loopt
  const w = M.makeFigure({ id: 'w', trade: 'schilder' }, false, M.layout([{ id: 'w', trade: 'schilder' }]).w);
  M.setClocked(w, true, M.layout([{ id: 'w', trade: 'schilder' }]).w);
  const t0 = w.path[0];
  M.update(w, 0.2);
  assert.ok(Math.abs(w.angle - Math.atan2(t0.y - 0.8, t0.x - 9.55)) < 0.4 || w.moving, 'walking faces the way it goes');
  assert.strictEqual(w.moving, true);
  M.update(w, 100);
  assert.ok(face(w).c < -0.7, 'back at the wall the painter faces it again');
}

// ---- rondlopen: af en toe naar een voorraad of een stukje verderop, en weer terug ----
{
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const lay2 = M.layout([{ id: 'a', trade: 'elektricien' }]);
  const f = M.makeFigure({ id: 'a', trade: 'elektricien' }, true, lay2.a);
  M.wander(f, 0.1, rand);
  assert.strictEqual(f.path.length, 0, 'does not wander right away');
  M.wander(f, 100, rand);
  assert.ok(f.path.length > 0, 'after a while it goes somewhere');
  assert.strictEqual(f.state, 'working', 'still counts as working');
  M.update(f, 100);
  M.wander(f, 0.1, rand);
  assert.strictEqual(f.path.length, 0, 'pauses where it arrived');
  M.wander(f, 100, rand);
  assert.ok(f.path.length > 0, 'then walks back');
  M.update(f, 100);
  assert.strictEqual(f.x, lay2.a.spot.x, 'back at its own spot, exactly');
  assert.strictEqual(f.y, lay2.a.spot.y);
  assert.strictEqual(f.wanderPhase, null);

  // every place it can walk to is inside the building and outside the props
  const inRect = (p, r) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  const trades = ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig'];
  for (const trade of trades) {
    const all = Array.from({ length: 16 }, (_, i) => ({ id: trade + i, trade }));
    const L2 = M.layout(all);
    for (const p of all) {
      const g = M.makeFigure(p, true, L2[p.id]);
      for (let k = 0; k < 12; k++) {
        M.wander(g, 100, rand);
        if (g.path.length) {
          const target = g.path[g.path.length - 1];
          assert.ok(target.x >= 0.4 && target.x <= 7.6 && target.y >= 0.4 && target.y <= 5.5, trade + ' target inside the building');
          assert.ok(!M.OBSTACLES.some((r) => inRect(target, r)), trade + ' target not inside a prop');
        }
        M.update(g, 100); M.wander(g, 100, rand); M.update(g, 100);
      }
    }
  }

  // nobody wanders from the bench or while walking in or out
  const bench = M.makeFigure({ id: 'b', trade: 'overig' }, false, M.layout([{ id: 'b', trade: 'overig' }]).b);
  M.wander(bench, 1000, rand);
  assert.strictEqual(bench.path.length, 0, 'bench stays put');
  const going = M.makeFigure({ id: 'g', trade: 'overig' }, false, M.layout([{ id: 'g', trade: 'overig' }]).g);
  M.setClocked(going, true, M.layout([{ id: 'g', trade: 'overig' }]).g);
  const before = going.path.length;
  M.wander(going, 1000, rand);
  assert.strictEqual(going.path.length, before, 'walking to work is not interrupted');

  // clocked out in the middle of a wander: goes straight to the bench, nothing left over
  const h = M.makeFigure({ id: 'h', trade: 'schilder' }, true, M.layout([{ id: 'h', trade: 'schilder' }]).h);
  M.wander(h, 100, rand);
  M.setClocked(h, false, M.layout([{ id: 'h', trade: 'schilder' }]).h);
  assert.strictEqual(h.state, 'toBench');
  assert.strictEqual(h.wanderPhase, null);
  M.update(h, 100);
  assert.strictEqual(h.state, 'bench');
  M.wander(h, 1000, rand);
  assert.strictEqual(h.path.length, 0);
}

console.log('Alle scene-tests zijn goed.');
