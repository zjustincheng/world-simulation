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
  neighbors,
} from "../dist/engine.js";
import { capitalCoordinates } from "../dist/names.js";
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
test("sea routes allow sixteen water tiles, reject seventeen, and choose the nearest shore", () => {
  const allowed = islandWorld([[10], [27]]);
  assert.deepEqual(nearbySeaLandings(allowed, 0), [cell(27)]);
  const distant = islandWorld([[10], [28]]);
  assert.deepEqual(nearbySeaLandings(distant, 0), []);
  const nearest = islandWorld([[10], [20], [27]]);
  assert.deepEqual(nearbySeaLandings(nearest, 0), [cell(20)]);
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
test("Greenland can reach and colonize Iceland across the Arctic route", () => {
  const s = createWorld("greenland-iceland", 0, "earth", "empty"),
    nearest = (longitude, latitude) =>
      s.owner.reduce((best, owner, i) => {
        if (owner === WATER) return best;
        const point = capitalCoordinates(s, i),
          distance =
            (point.longitude - longitude) ** 2 +
            (point.latitude - latitude) ** 2;
        return distance < best.distance ? { cell: i, distance } : best;
      }, { cell: -1, distance: Infinity }).cell,
    component = (start) => {
      const queue = [start],
        cells = new Set(queue);
      for (let head = 0; head < queue.length; head++)
        for (const next of neighbors(queue[head]))
          if (s.owner[next] !== WATER && !cells.has(next)) {
            cells.add(next);
            queue.push(next);
          }
      return cells;
    },
    greenland = component(nearest(-42, 72)),
    iceland = component(nearest(-19, 65));
  spawnNation(s, [...greenland][0], { radius: 0, name: "Greenland" });
  for (const cell of greenland) s.owner[cell] = 0;
  s.settings.wars = false;
  s.settings.revolts = false;
  const coasts = [...greenland].filter((cell) =>
    neighbors(cell).some((next) => s.owner[next] === WATER),
  );
  assert.ok(
    nearbySeaLandings(s, 0, NEUTRAL, coasts, true).some((cell) =>
      iceland.has(cell),
    ),
  );
  for (let year = 0; year < 400; year++) tick(s);
  assert.ok([...iceland].some((cell) => s.owner[cell] === 0));
  validate(s);
});
test("forced naval wars move territory across Greenland–Iceland, Iceland–UK, and UK–mainland routes", () => {
  const base = createWorld("war-routes", 0, "earth", "empty"),
    nearest = (longitude, latitude) =>
      base.owner.reduce((best, owner, i) => {
        if (owner === WATER) return best;
        const point = capitalCoordinates(base, i),
          distance =
            (point.longitude - longitude) ** 2 +
            (point.latitude - latitude) ** 2;
        return distance < best.distance ? { cell: i, distance } : best;
      }, { cell: -1, distance: Infinity }).cell,
    component = (start) => {
      const queue = [start], cells = new Set(queue);
      for (let head = 0; head < queue.length; head++)
        for (const next of neighbors(queue[head]))
          if (base.owner[next] !== WATER && !cells.has(next)) {
            cells.add(next);
            queue.push(next);
          }
      return cells;
    },
    locations = [
      ["Greenland", -42, 72],
      ["Iceland", -19, 65],
      ["UK", -3, 55],
      ["mainland", 2, 51],
    ],
    lands = locations.map(([, lon, lat]) => component(nearest(lon, lat)));
  for (const [left, right] of [[0, 1], [1, 2], [2, 3]]) {
    const s = createWorld(`forced-sea-war-${left}-${right}`, 0, "earth", "empty");
    const ids = [];
    for (const index of [left, right]) {
      const id = spawnNation(s, [...lands[index]][0], { radius: 0 });
      ids.push(id);
      for (const tile of lands[index]) s.owner[tile] = id;
    }
    s.settings.expansion = false;
    s.settings.wars = false;
    s.settings.alliances = false;
    s.settings.revolts = false;
    assert.equal(declareWar(s, ids[0], ids[1]), true);
    for (let year = 0; year < 12 && s.wars.length; year++) tick(s);
    assert.ok(
      s.owner.some((owner) => owner === ids[0] || owner === ids[1]) &&
        [...lands[left], ...lands[right]].some((tile) =>
          s.owner[tile] !== (lands[left].has(tile) ? ids[0] : ids[1]),
        ),
      `${locations[left][0]} and ${locations[right][0]} should exchange territory`,
    );
    validate(s);
  }
});
test("every non-edge island in every map has a reachable next shore", async () => {
  const { REAL_MAPS } = await import("../dist/real-maps.js");
  for (const preset of ["islands", ...Object.keys(REAL_MAPS)]) {
    const s = createWorld(`island-audit-${preset}`, 0, preset, "empty"),
      seen = new Set(),
      components = [];
    for (let start = 0; start < s.owner.length; start++)
      if (s.owner[start] === NEUTRAL && !seen.has(start)) {
        const cells = [start];
        seen.add(start);
        for (let head = 0; head < cells.length; head++)
          for (const next of neighbors(cells[head]))
            if (s.owner[next] === NEUTRAL && !seen.has(next)) {
              seen.add(next);
              cells.push(next);
            }
        components.push(cells);
      }
    const nationIds = components.map((cells) => {
      const id = spawnNation(s, cells[0], { radius: 0, quiet: true });
      for (const tile of cells) s.owner[tile] = id;
      return id;
    });
    for (let index = 0; index < components.length; index++) {
      const cells = components[index],
        coasts = cells.filter((tile) =>
          neighbors(tile).some((next) => s.owner[next] === WATER),
        );
      if (!coasts.length) continue;
      const edgeFragment = cells.some((tile) => {
        const x = tile % W, y = Math.floor(tile / W);
        return x === 0 || x === W - 1 || y === 0 || y === H - 1;
      });
      const reachable = nearbySeaLandings(
        s,
        nationIds[index],
        null,
        coasts,
        true,
      );
      assert.ok(
        reachable.length || edgeFragment,
        `${preset} landmass ${index} has no reachable next shore`,
      );
    }
  }
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
