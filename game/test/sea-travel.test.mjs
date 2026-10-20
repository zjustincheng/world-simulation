import test from "node:test";
import assert from "node:assert/strict";
import {
  W,
  H,
  NEUTRAL,
  WATER,
  createWorld,
  spawnNation,
  nearbySeaLandings,
  tick,
  declareWar,
  validate,
} from "../dist/engine.js";
const cell = (x, y = 50) => y * W + x;
function islandWorld(points) {
  const s = createWorld("sea-regression", 0, "blank");
  for (const [x, y = 50] of points) {
    s.owner[cell(x, y)] = NEUTRAL;
    s.terrain[cell(x, y)] = 0.12;
  }
  spawnNation(s, cell(...points[0]), { radius: 0 });
  s.settings.alliances = false;
  s.settings.revolts = false;
  return s;
}
test("nearby sea routes allow four water tiles, reject five, and choose the nearest shore", () => {
  const allowed = islandWorld([[10], [15]]);
  assert.deepEqual(nearbySeaLandings(allowed, 0), [cell(15)]);
  const distant = islandWorld([[10], [16]]);
  assert.deepEqual(nearbySeaLandings(distant, 0), []);
  const nearest = islandWorld([[10], [13], [15]]);
  assert.deepEqual(nearbySeaLandings(nearest, 0), [cell(13)]);
});
test("diplomacy can see every reachable shore beyond the nearest landing", () => {
  const s = islandWorld([[10], [15], [30], [34]]);
  spawnNation(s, cell(15), { radius: 0 });
  spawnNation(s, cell(34), { radius: 0 });
  s.owner[cell(30)] = 0;
  assert.deepEqual(nearbySeaLandings(s, 0, null), [cell(34)]);
  assert.deepEqual(
    nearbySeaLandings(s, 0, null, null, true).sort((a, b) => a - b),
    [cell(15), cell(34)],
  );
});
test("sea routes cannot pass through land, cross disconnected water or wrap map edges", () => {
  const blocked = islandWorld([[10], [14]]);
  for (let y = 0; y < H; y++) {
    blocked.owner[cell(12, y)] = NEUTRAL;
    blocked.terrain[cell(12, y)] = 0.12;
  }
  spawnNation(blocked, cell(14), { radius: 0 });
  assert.deepEqual(nearbySeaLandings(blocked, 0, 1), []);
  const edge = islandWorld([[0], [W - 1]]);
  assert.deepEqual(nearbySeaLandings(edge, 0), []);
  const corner = islandWorld([
    [W - 1, 40],
    [0, 41],
  ]);
  assert.deepEqual(nearbySeaLandings(corner, 0), []);
});
test("centuries of colonization can reach nearby islands but never a distant ocean shore", () => {
  const s = islandWorld([[10], [14], [100]]);
  s.settings.wars = false;
  for (let i = 0; i < 300; i++) tick(s);
  assert.equal(s.owner[cell(14)], 0);
  assert.equal(s.owner[cell(100)], NEUTRAL);
  assert.equal(s.owner[cell(50)], WATER);
  validate(s);
});
test("forced war cannot teleport an invasion across a wide ocean", () => {
  const s = islandWorld([[10], [100]]);
  spawnNation(s, cell(100), { radius: 0 });
  s.settings.expansion = false;
  s.settings.wars = false;
  for (let i = 0; i < 160; i++) {
    declareWar(s, 0, 1);
    tick(s);
  }
  assert.equal(s.owner[cell(10)], 0);
  assert.equal(s.owner[cell(100)], 1);
  assert.ok(
    Object.values(s.warStats).every((gains) => gains.every((n) => n === 0)),
  );
  validate(s);
});
test("short naval invasions remain possible and AI ignores unreachable overseas rivals", () => {
  const near = islandWorld([[10], [14]]);
  spawnNation(near, cell(14), { radius: 0 });
  near.settings.expansion = false;
  near.settings.wars = false;
  declareWar(near, 0, 1);
  for (let i = 0; i < 12; i++) tick(near);
  assert.equal(near.owner[cell(10)], near.owner[cell(14)]);
  validate(near);
  const far = islandWorld([[10], [100]]);
  spawnNation(far, cell(100), { radius: 0 });
  far.settings.expansion = false;
  for (let i = 0; i < 320; i++) tick(far);
  assert.equal(far.wars.length, 0);
  assert.equal(
    far.events.some((e) => e.type === "war"),
    false,
  );
});
test("a coastline lost earlier in the turn cannot launch a new landing", () => {
  const s = islandWorld([[10], [14]]);
  const stale = [cell(10)];
  s.owner[cell(10)] = NEUTRAL;
  assert.deepEqual(nearbySeaLandings(s, 0, NEUTRAL, stale), []);
});
