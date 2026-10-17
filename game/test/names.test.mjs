import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  spawnNation,
  rebel,
  validate,
  W,
  H,
} from "../dist/engine.js";
import { REAL_MAPS } from "../dist/real-maps.js";
import {
  capitalCoordinates,
  capitalRegion,
  generateNationName,
} from "../dist/names.js";
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
function location(s, lon, lat) {
  const [west, south, east, north] = REAL_MAPS[s.preset].bounds;
  return (
    Math.floor(((merc(north) - merc(lat)) / (merc(north) - merc(south))) * H) *
      W +
    Math.floor(((lon - west) / (east - west)) * W)
  );
}
test("real capitals draw regional names consistently across Earth and regional map projections", () => {
  const cases = [
    ["earth", 0, 51, "Albion"],
    ["europe", 0, 51, "Albion"],
    ["earth", 2, 48, "Gaul"],
    ["europe", 2, 48, "Gaul"],
    ["africa", 31, 27, "Nile"],
    ["asia", 138, 37, "Yamato"],
    ["south-america", -75, -13, "Andes"],
    ["oceania", 133, -25, "Red Centre"],
  ];
  for (const [preset, lon, lat, region] of cases) {
    const s = createWorld("naming", 0, preset),
      cell = location(s, lon, lat);
    assert.equal(capitalRegion(s, cell).noun, region);
    const coords = capitalCoordinates(s, cell);
    assert.ok(Math.abs(coords.longitude - lon) < 3);
    assert.ok(Math.abs(coords.latitude - lat) < 3);
    const name = generateNationName(s, cell);
    assert.ok(name.length > 8 && name.length <= 35);
  }
});
test("previews are deterministic, leave simulation randomness alone, and match founding names", () => {
  const s = createWorld("preview", 0, "earth"),
    cell = location(s, 2, 48),
    rng = s.rng;
  const before = structuredClone(s);
  const name = generateNationName(s, cell);
  assert.equal(generateNationName(s, cell), name);
  assert.equal(s.rng, rng);
  assert.deepEqual(s, before);
  const id = spawnNation(s, cell, { radius: 0 });
  assert.equal(s.nations[id].name, name);
  validate(s);
});
test("custom names take priority and generated names avoid existing and fallen names", () => {
  const s = createWorld("distinct", 0, "europe"),
    cell = location(s, 2, 48);
  const id = spawnNation(s, cell, { name: "My Custom Kingdom", radius: 0 });
  assert.equal(s.nations[id].name, "My Custom Kingdom");
  const used = new Set();
  for (let i = 0; i < 25; i++) {
    const name = generateNationName(s, cell);
    assert.equal(used.has(name), false);
    used.add(name);
    s.nations.push({ id: s.nations.length, name, dead: 1 });
  }
});
test("generated map names reflect coasts, mountains, islands, and latitude", () => {
  const s = createWorld("terrain", 0, "arena"),
    north = 10 * W + 80,
    south = 90 * W + 80,
    interior = 50 * W + 80;
  assert.match(capitalRegion(s, north).noun, /Winter/);
  assert.match(capitalRegion(s, south).noun, /Sun/);
  s.terrain[interior] = 0.5;
  assert.equal(capitalRegion(s, interior).label, "Highlands");
  s.terrain[interior] = 0.12;
  s.terrain[interior + 1] = -0.2;
  assert.equal(capitalRegion(s, interior).label, "Coastal realm");
  const island = createWorld("island", 0, "blank");
  island.terrain[interior] = 0.12;
  assert.equal(capitalRegion(island, interior).label, "Island realm");
});
test("revolutions use their own capital region and established names survive capital relocation and saves", () => {
  const s = createWorld("revolt", 2, "arena");
  assert.equal(rebel(s, 0), true);
  const rebelNation = s.nations.at(-1);
  assert.equal(
    rebelNation.name,
    generateNationName(s, rebelNation.capital, {
      excludeId: rebelNation.id,
      revolution: true,
    }),
  );
  const old = s.nations[0].name;
  s.nations[0].capital = s.owner.findIndex((id) => id === 0);
  const saved = validate(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.nations[0].name, old);
});
