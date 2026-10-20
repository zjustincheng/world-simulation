import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  tick,
  stats,
  declareWar,
  peace,
  ally,
  annex,
  collapse,
  rebel,
  spawnNation,
  paint,
  validate,
  W,
  H,
  WATER,
  NEUTRAL,
  neighbors,
  allied,
  allianceMembers,
} from "../dist/engine.js";

const landCount = (s) => s.owner.filter((n) => n !== WATER).length;
const owned = (s) => stats(s).reduce((a, b) => a + b, 0);

test("all map presets reproduce from a seed and preserve valid capitals", () => {
  for (const preset of ["continents", "pangaea", "islands", "arena", "blank"]) {
    const a = createWorld("test-world", 16, preset);
    assert.deepEqual(a, createWorld("test-world", 16, preset));
    assert.equal(a.owner.length, W * H);
    assert.ok(a.owner.includes(WATER));
    a.nations.forEach((n) => assert.equal(a.owner[n.capital], n.id));
    validate(a);
    if (preset === "blank") assert.equal(a.nations.length, 0);
  }
});

test("settlements grow into neutral land and do not turn water into territory", () => {
  const s = createWorld("expansion", 12, "arena", "seeds");
  s.settings.wars = false;
  const before = owned(s),
    water = s.owner.map((n, i) => (n === WATER ? i : -1)).filter((i) => i >= 0);
  for (let y = 0; y < 20; y++) tick(s);
  assert.ok(owned(s) > before * 3);
  water.forEach((i) => assert.equal(s.owner[i], WATER));
  validate(s);
});

test("four centuries of conflict conserve land and keep valid nations and relations", () => {
  const s = createWorld("CONFLICT-2048", 16);
  const land = landCount(s);
  let mostConcurrentWars = 0;
  for (let y = 0; y < 400; y++) {
    tick(s);
    mostConcurrentWars = Math.max(mostConcurrentWars, s.wars.length);
    validate(s);
    assert.equal(landCount(s), land);
    s.nations.forEach((n) => {
      if (stats(s)[n.id]) assert.equal(s.owner[n.capital], n.id);
    });
  }
  assert.equal(s.year, 401);
  assert.ok(s.warHistory.length > 0);
  assert.equal(mostConcurrentWars, 1);
  assert.ok(new Set(s.warHistory.flatMap((war) => [war.a, war.b])).size >= 8);
  assert.ok(s.events.some((event) => event.text.includes("rebels against")));
});

test("war moves borders, alliances stop wars, peace and annexation work", () => {
  const s = createWorld("arena-battle", 2, "arena");
  s.settings.wars = false;
  s.settings.alliances = false;
  s.settings.revolts = false;
  assert.equal(declareWar(s, 0, 1), true);
  assert.equal(declareWar(s, 1, 0), false);
  const original = [...s.owner];
  for (let i = 0; i < 10; i++) tick(s);
  assert.notDeepEqual(s.owner, original);
  assert.ok(s.flashes.length);
  ally(s, 0, 1);
  assert.equal(s.wars.length, 0);
  assert.deepEqual(s.alliances, [[0, 1]]);
  declareWar(s, 0, 1);
  assert.equal(s.alliances.length, 0);
  peace(s, 0);
  assert.equal(s.wars.length, 0);
  const total = owned(s);
  annex(s, 0, 1);
  assert.equal(stats(s)[0], total);
  assert.equal(stats(s)[1], 0);
  assert.notEqual(s.nations[1].dead, null);
  validate(s);
});

test("peace terms absorb a conquered nation left with only a few tiles", () => {
  const s = createWorld("tiny-peace-remnant", 2, "arena");
  assert.equal(
    declareWar(s, 0, 1, { reason: "a decisive territorial campaign" }),
    true,
  );
  const remnants = [
    s.nations[1].capital,
    ...neighbors(s.nations[1].capital).filter((cell) => s.owner[cell] === 1),
  ].slice(0, 3);
  assert.equal(remnants.length, 3);
  s.owner = s.owner.map((owner) => (owner === 1 ? 0 : owner));
  for (const cell of remnants) s.owner[cell] = 1;
  s.nations[1].capital = remnants[0];
  s.warStats["0,1"] = [100, 0];
  assert.equal(peace(s, 0, 1), 1);
  assert.equal(stats(s)[1], 0);
  assert.equal(s.nations[1].dead, s.year);
  assert.match(s.warHistory[0].outcome, /accepts full annexation/);
  assert.ok(
    s.events.some((event) => event.text.includes("loses its independence")),
  );
  validate(s);
});

test("campaigns do not leave detached territory pockets surrounded by one victor", () => {
  const s = createWorld("coherent-fronts", 2, "pangaea");
  s.settings.expansion = false;
  assert.equal(declareWar(s, 0, 1, { reason: "a contested frontier" }), true);
  for (let year = 0; year < 120; year++) {
    tick(s);
    for (const nation of s.nations) {
      const visited = new Set();
      for (let start = 0; start < s.owner.length; start++) {
        if (s.owner[start] !== nation.id || visited.has(start)) continue;
        const component = [start],
          borderOwners = new Set();
        visited.add(start);
        let touchesEdge = false;
        for (let cursor = 0; cursor < component.length; cursor++) {
          const cell = component[cursor];
          if (
            cell % W === 0 ||
            cell % W === W - 1 ||
            cell < W ||
            cell >= W * (H - 1)
          )
            touchesEdge = true;
          for (const next of neighbors(cell)) {
            if (s.owner[next] === nation.id && !visited.has(next)) {
              visited.add(next);
              component.push(next);
            } else if (s.owner[next] !== nation.id) {
              borderOwners.add(s.owner[next]);
            }
          }
        }
        if (component.includes(nation.capital) || touchesEdge) continue;
        assert.ok(
          borderOwners.size !== 1 ||
            ![...borderOwners].every((owner) => owner >= 0),
          `${nation.name} has an isolated pocket enclosed by nation ${[...borderOwners][0]}`,
        );
      }
    }
  }
  validate(s);
});

test("alliance pacts form multi-country blocs and player wars break the linking pacts", () => {
  const s = createWorld("three-state-pact", 3, "arena");
  ally(s, 0, 1);
  ally(s, 1, 2);
  assert.equal(allied(s, 0, 2), true);
  assert.deepEqual(allianceMembers(s, 0).sort(), [1, 2]);
  assert.equal(
    declareWar(s, 0, 2, { force: false, reason: "a border claim" }),
    false,
  );
  assert.equal(declareWar(s, 0, 2), true);
  assert.equal(allied(s, 0, 2), false);
  validate(s);
});

test("an alliance supports its member without opening a second war", () => {
  const s = createWorld("alliance-cascade", 4, "arena");
  ally(s, 1, 2);
  ally(s, 1, 3);
  assert.equal(declareWar(s, 0, 1, { reason: "a contested frontier" }), true);
  assert.ok(s.wars.some((war) => war[0] === 0 && war[1] === 1));
  assert.equal(s.wars.length, 1);
  assert.ok(allianceMembers(s, 1).includes(2));
  assert.deepEqual(s.warHistory[0].alliesB, [2, 3]);
  assert.match(s.warHistory[0].reason, /enter the campaign in support/);
  assert.equal(declareWar(s, 2, 0), false);
  validate(s);
});

test("revolutions produce a connected new country and collapse frees territory", () => {
  const s = createWorld("rebellion", 2, "arena");
  s.nations[0].tech = {
    age: 2,
    progress: 17.5,
    unlocked: ["three-field", "stirrups", "field-drill"],
  };
  const inheritedTech = structuredClone(s.nations[0].tech);
  assert.equal(rebel(s, 0), true);
  const id = s.nations.length - 1,
    cells = s.owner.map((n, i) => (n === id ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(s.nations[id].tech, inheritedTech);
  assert.notEqual(s.nations[id].tech, s.nations[0].tech);
  s.nations[id].tech.progress++;
  assert.equal(s.nations[0].tech.progress, inheritedTech.progress);
  const visited = new Set([cells[0]]),
    queue = [cells[0]];
  for (let h = 0; h < queue.length; h++)
    for (const j of neighbors(queue[h]))
      if (s.owner[j] === id && !visited.has(j)) {
        visited.add(j);
        queue.push(j);
      }
  assert.equal(visited.size, cells.length);
  assert.ok(s.wars.some((p) => p[0] === 0 && p[1] === id));
  collapse(s, id);
  cells.forEach((i) => assert.equal(s.owner[i], NEUTRAL));
  assert.equal(stats(s)[id], 0);
  validate(s);
});

test("revolts favor a distant disconnected province over the capital heartland", () => {
  const s = createWorld("remote-rebellion", 0, "blank"),
    capital = 50 * W + 30,
    island = 50 * W + 85;
  paint(s, capital, 8, "land");
  const nation = spawnNation(s, capital, { radius: 8 });
  paint(s, island, 4, "land");
  paint(s, island, 4, "territory", nation);
  const remoteCells = s.owner
    .map((owner, cell) =>
      owner === nation && Math.abs((cell % W) - (island % W)) <= 4 ? cell : -1,
    )
    .filter((cell) => cell >= 0);
  assert.ok(remoteCells.length >= 8);
  assert.equal(rebel(s, nation), true);
  const rebelId = s.nations.length - 1;
  assert.ok(remoteCells.includes(s.nations[rebelId].capital));
  assert.ok(
    ((s.nations[rebelId].capital % W) - (capital % W)) ** 2 +
      (Math.floor(s.nations[rebelId].capital / W) - Math.floor(capital / W)) **
        2 >
      16,
  );
  assert.ok(remoteCells.some((cell) => s.owner[cell] === rebelId));
  validate(s);
});

test("old extinct nation records do not prevent new revolts", () => {
  const s = createWorld("revolt-history", 2, "arena");
  // Model a save that has accumulated many historical countries while the
  // original nation still controls enough land to support another revolt.
  while (s.nations.length < 64) {
    const id = s.nations.length;
    s.nations.push({ ...structuredClone(s.nations[0]), id, dead: s.year });
  }
  assert.equal(rebel(s, 0), true);
  assert.equal(s.nations.length, 65);
  validate(s);
});

test("revolts wait for the active campaign to settle", () => {
  const s = createWorld("revolt-during-war", 2, "arena");
  declareWar(s, 0, 1, { reason: "a border crisis" });
  const count = s.nations.length;
  assert.equal(rebel(s, 0), false);
  assert.equal(s.nations.length, count);
  assert.equal(s.wars.length, 1);
  validate(s);
});

test("map editing supports land, water, spawning, ownership, erasing and capital relocation", () => {
  const s = createWorld("editor", 0, "blank"),
    center = 50 * W + 80;
  paint(s, center, 10, "land");
  assert.equal(s.owner[center], NEUTRAL);
  const id = spawnNation(s, center);
  assert.equal(id, 0);
  assert.equal(s.owner[center], id);
  paint(s, center + 5, 2, "territory", id);
  assert.equal(s.owner[center + 5], id);
  paint(s, center, 1, "water");
  assert.equal(s.owner[center], WATER);
  assert.notEqual(s.nations[id].capital, center);
  assert.equal(s.owner[s.nations[id].capital], id);
  paint(s, center + 5, 1, "erase");
  assert.equal(s.owner[center + 5], NEUTRAL);
  assert.equal(spawnNation(s, 0), -1);
  assert.equal(paint(s, -1, 3, "land"), false);
  validate(s);
});

test("paused AI freezes combat, economy and expansion while the clock can advance", () => {
  const s = createWorld("disabled", 4, "arena", "seeds");
  declareWar(s, 0, 1);
  s.settings.ai = false;
  const before = structuredClone(s);
  tick(s);
  assert.deepEqual(s.owner, before.owner);
  assert.deepEqual(s.nations, before.nations);
  assert.deepEqual(s.wars, before.wars);
  assert.equal(s.year, before.year + 1);
});

test("saves preserve the deterministic future, legacy saves migrate, malformed imports fail", () => {
  const a = createWorld();
  tick(a);
  const b = validate(JSON.parse(JSON.stringify(a)));
  tick(a);
  tick(b);
  assert.deepEqual(a, b);
  const legacy = createWorld("old", 8);
  legacy.version = 1;
  delete legacy.settings;
  legacy.nations.forEach((n) => {
    for (const k of ["efficiency", "peak", "kills", "born", "dead"])
      delete n[k];
  });
  const migrated = validate(legacy);
  assert.equal(migrated.version, 2);
  tick(migrated);
  validate(migrated);
  assert.throws(() => validate({ version: 2 }));
  const bad = structuredClone(a);
  bad.owner[0] = 999;
  assert.throws(() => validate(bad));
  const fractional = structuredClone(a);
  fractional.wars = [[0.5, 1, 1]];
  assert.throws(() => validate(fractional));
  const invalidSettings = structuredClone(a);
  invalidSettings.settings.ai = "yes";
  assert.throws(() => validate(invalidSettings));
});

test("real-world presets have fixed coastlines, allow empty starts, and place known landmarks correctly", async () => {
  const { REAL_MAPS } = await import("../dist/real-maps.js");
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const cases = {
    earth: {
      land: [
        [-100, 40],
        [-60, -5],
        [20, 20],
        [105, 35],
        [135, -25],
      ],
      sea: [
        [-30, 0],
        [90, -30],
      ],
    },
    europe: {
      land: [
        [2, 49],
        [-2, 54],
        [25, 55],
      ],
      sea: [[-20, 50]],
    },
    asia: {
      land: [
        [105, 35],
        [78, 22],
      ],
      sea: [[90, -5]],
    },
    africa: {
      land: [
        [20, 5],
        [20, -20],
      ],
      sea: [[-15, -10]],
    },
    "north-america": {
      land: [
        [-100, 40],
        [-110, 55],
      ],
      sea: [[-60, 30]],
    },
    "south-america": {
      land: [
        [-60, -10],
        [-65, -30],
      ],
      sea: [[-35, -20]],
    },
    oceania: {
      land: [
        [135, -25],
        [145, -20],
      ],
      sea: [[165, -25]],
    },
  };
  for (const [preset, points] of Object.entries(cases)) {
    const s = createWorld("geography-a", 0, preset),
      other = createWorld("geography-b", 0, preset);
    assert.equal(s.nations.length, 0);
    assert.deepEqual(s.owner, other.owner);
    assert.ok(s.owner.includes(NEUTRAL));
    assert.ok(s.owner.includes(WATER));
    validate(s);
    const [west, south, east, north] = REAL_MAPS[preset].bounds;
    const cell = ([lon, lat]) =>
      Math.floor(
        ((merc(north) - merc(lat)) / (merc(north) - merc(south))) * H,
      ) *
        W +
      Math.floor(((lon - west) / (east - west)) * W);
    for (const point of points.land)
      assert.equal(
        s.owner[cell(point)],
        NEUTRAL,
        `${preset}: land at ${point}`,
      );
    for (const point of points.sea)
      assert.equal(s.owner[cell(point)], WATER, `${preset}: ocean at ${point}`);
    const initial = s.owner.indexOf(NEUTRAL),
      id = spawnNation(s, initial, { name: "My Republic", radius: 1 });
    assert.equal(id, 0);
    assert.equal(s.nations[id].name, "My Republic");
    assert.equal(s.owner[initial], id);
    assert.equal(s.year, 1);
    validate(s);
  }
});
