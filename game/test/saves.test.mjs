import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  tick,
  declareWar,
  peace,
  hasTruce,
  validate,
} from "../dist/engine.js";
import {
  readSaves,
  saveWorld,
  deleteSave,
  readRecovery,
  writeRecovery,
  LIBRARY_KEY,
} from "../dist/saves.js";
class MemoryStorage {
  data = new Map();
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, v);
  }
}
test("six named slots can be loaded, replaced and deleted without altering other saves", () => {
  const storage = new MemoryStorage(),
    world = createWorld("library", 2, "arena");
  for (let i = 0; i < 6; i++) saveWorld(storage, world, `World ${i}`);
  assert.equal(readSaves(storage).length, 6);
  assert.throws(() => saveWorld(storage, world, "seventh"));
  const before = readSaves(storage),
    id = before[2].id;
  tick(world);
  saveWorld(storage, world, "Replaced", id);
  const after = readSaves(storage);
  assert.equal(after[2].world.year, 2);
  assert.deepEqual(after[0], before[0]);
  deleteSave(storage, id);
  assert.equal(readSaves(storage).length, 5);
  saveWorld(storage, world, "New");
  assert.equal(readSaves(storage).length, 6);
});
test("failed writes preserve existing saves, corrupt libraries are not silently overwritten", () => {
  const storage = new MemoryStorage(),
    world = createWorld();
  saveWorld(storage, world, "Keep me");
  const before = storage.getItem(LIBRARY_KEY);
  storage.setItem = () => {
    throw Error("Quota exceeded");
  };
  assert.throws(() => saveWorld(storage, world, "Too large"));
  assert.equal(storage.getItem(LIBRARY_KEY), before);
  const broken = new MemoryStorage();
  broken.setItem(LIBRARY_KEY, "not json");
  assert.throws(() => saveWorld(broken, world, "Do not erase"));
  assert.equal(broken.getItem(LIBRARY_KEY), "not json");
});
test("legacy single saves migrate and recovery preserves the deterministic future", () => {
  const storage = new MemoryStorage(),
    world = createWorld();
  storage.setItem("world-simulation-save", JSON.stringify(world));
  assert.equal(readSaves(storage)[0].id, "legacy");
  saveWorld(storage, world, "Second world");
  assert.equal(readSaves(storage).length, 2);
  writeRecovery(storage, world);
  const recovered = readRecovery(storage).world;
  tick(world);
  tick(recovered);
  assert.deepEqual(recovered, world);
});
test("peace blocks AI declarations for 15 years and manual war can override a truce", () => {
  const s = createWorld("truce", 2, "arena");
  declareWar(s, 0, 1);
  tick(s);
  assert.ok(s.warStats["0,1"].some((n) => n > 0));
  peace(s, 0, 1);
  assert.equal(hasTruce(s, 0, 1), true);
  assert.equal(declareWar(s, 0, 1, { force: false }), false);
  assert.equal(s.warStats["0,1"], undefined);
  s.settings.wars = false;
  s.settings.alliances = false;
  s.settings.revolts = false;
  for (let i = 0; i < 14; i++) {
    tick(s);
    assert.equal(declareWar(s, 0, 1, { force: false }), false);
  }
  tick(s);
  assert.equal(hasTruce(s, 0, 1), false);
  assert.equal(declareWar(s, 0, 1, { force: false }), true);
  peace(s, 0, 1);
  assert.equal(declareWar(s, 0, 1), true);
  assert.equal(hasTruce(s, 0, 1), false);
  validate(s);
});
test("older saves acquire empty diplomacy fields, invalid combat statistics are rejected", () => {
  const s = createWorld();
  delete s.truces;
  delete s.warStats;
  declareWar(s, 0, 1);
  delete s.warStats;
  const restored = validate(s);
  assert.deepEqual(restored.warStats["0,1"], [0, 0]);
  assert.deepEqual(restored.truces, []);
  restored.warStats["0,1"] = [-1, 2];
  assert.throws(() => validate(restored));
});
