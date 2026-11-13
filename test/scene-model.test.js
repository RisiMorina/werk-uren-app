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

console.log('Alle scene-tests zijn goed.');
