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
assert.strictEqual(M.iso(1, 0, 0).sy, 16);
assert.strictEqual(M.iso(0, 1, 0).sx, -32);
assert.strictEqual(M.iso(0, 0, 10).sy, -10, 'z lifts up');

// bench: 16 seats, all different and not on top of each other
const seats = Array.from({ length: 16 }, (_, i) => M.benchSeat(i));
assert.ok(minDistance(seats) >= 0.6, 'bench seats keep distance');
assert.ok(seats.every((s) => s.x > M.WORLD.building.x1), 'bench is outside the building');

// work spots
const same = Array.from({ length: 16 }, (_, i) => M.workSpot('elektricien', i));
assert.ok(same.every(inside), 'sixteen of one trade all stay inside the building');
assert.ok(minDistance(same) >= 0.6, 'sixteen of one trade do not overlap');
for (const t of ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig']) {
  const all = Array.from({ length: 16 }, (_, i) => M.workSpot(t, i));
  assert.ok(all.every(inside), t + ' stays inside');
  assert.ok(minDistance(all) >= 0.6, t + ' does not overlap');
}
const firsts = ['elektricien', 'vloerlegger', 'schilder', 'loodgieter', 'timmerman', 'overig'].map((t) => M.workSpot(t, 0));
assert.ok(minDistance(firsts) >= 1.0, 'each trade has its own place');
assert.deepStrictEqual(M.workSpot('onbekend', 0), M.workSpot('overig', 0), 'unknown trade works like overig');

// layout: seat by order, spot by order within the trade
const people = [
  { id: 'a', trade: 'elektricien' }, { id: 'b', trade: 'schilder' }, { id: 'c', trade: 'elektricien' },
];
const lay = M.layout(people);
assert.deepStrictEqual(lay.a.seat, M.benchSeat(0));
assert.deepStrictEqual(lay.c.seat, M.benchSeat(2));
assert.deepStrictEqual(lay.a.spot, M.workSpot('elektricien', 0));
assert.deepStrictEqual(lay.c.spot, M.workSpot('elektricien', 1));
assert.deepStrictEqual(lay.b.spot, M.workSpot('schilder', 0));
assert.deepStrictEqual(M.layout(people), lay, 'layout is stable');
assert.deepStrictEqual(M.layout([]), {});

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
