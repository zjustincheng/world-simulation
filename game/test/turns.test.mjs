import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, validate, NEUTRAL } from "../dist/engine.js";
import { advanceTurn } from "../dist/turns.js";

test("each explicit turn advances once and reports exact ownership differences", () => {
  const s = createWorld("turn-expansion", 6, "arena", "seeds");
  const owners = [...s.owner];
  const report = advanceTurn(s, 1);
  assert.equal(s.year, 2);
  assert.equal(report.year, 2);
  const expected = s.owner.flatMap((to, cell) =>
    to === owners[cell] ? [] : [{ cell, from: owners[cell], to }],
  );
  assert.deepEqual(report.changes, expected);
  assert.ok(report.claimed > 0);
  assert.equal(
    report.claimed,
    expected.filter((c) => c.from === NEUTRAL && c.to >= 0).length,
  );
  assert.equal(
    report.transferred,
    expected.filter((c) => c.from >= 0 && c.to >= 0).length,
  );
  assert.equal(
    report.nations.reduce((sum, n) => sum + n.delta, 0),
    report.claimed,
  );
  assert.ok(report.events.every((e) => e.year === 2));
});

test("turns and domestic events remain deterministic across saved worlds", () => {
  const a = createWorld("turn-events", 8, "arena");
  const eventTypes = new Set();
  for (let i = 0; i < 80; i++) {
    const b = validate(JSON.parse(JSON.stringify(a)));
    const report = advanceTurn(a);
    assert.deepEqual(report, advanceTurn(b));
    assert.deepEqual(a, b);
    validate(a);
    report.events.forEach((e) => eventTypes.add(e.type));
  }
  for (const type of ["prosperity", "hardship", "reform"])
    assert.ok(eventTypes.has(type));
});

test("empty worlds cannot advance and disabled AI leaves nations unchanged", () => {
  const empty = createWorld("empty", 0);
  const snapshot = structuredClone(empty);
  assert.throws(() => advanceTurn(empty), /at least one nation/);
  assert.deepEqual(empty, snapshot);
  const s = createWorld("disabled-turn", 4);
  s.settings.ai = false;
  const before = structuredClone(s);
  const report = advanceTurn(s, 1);
  assert.equal(s.year, before.year + 1);
  assert.deepEqual(s.nations, before.nations);
  assert.deepEqual(s.owner, before.owner);
  assert.equal(report.changes.length, 0);
  assert.equal(report.events.length, 0);
});

test("default chapters resolve five years and retain events from every year", () => {
  const a = createWorld("chapters", 8, "arena", "seeds");
  const report = advanceTurn(a);
  assert.deepEqual(
    report.events,
    a.events.filter((e) => e.year > 1).sort((a, b) => b.year - a.year),
  );
  assert.equal(report.years, 5);
  assert.equal(a.year, 6);
  assert.ok(report.events.length);
  assert.ok(report.events.every((e) => e.year > 1 && e.year <= 6));
  const one = createWorld("chapters", 8, "arena", "seeds");
  assert.ok(report.claimed > advanceTurn(one, 1).claimed);
  const before = structuredClone(a);
  assert.throws(() => advanceTurn(a, 100));
  assert.deepEqual(a, before);
});

test("automatic placement preserves terrain and countries and respects capacity", async () => {
  const { populateWorld } = await import("../dist/setup.js");
  const s = createWorld("autoplacement", 3, "earth", "seeds");
  const before = structuredClone(s),
    other = structuredClone(s);
  assert.equal(populateWorld(s, 12), 12);
  assert.equal(populateWorld(other, 12), 12);
  assert.deepEqual(s, other);
  before.owner.forEach((owner, i) => {
    if (owner !== NEUTRAL) assert.equal(s.owner[i], owner);
  });
  assert.equal(s.year, before.year);
  validate(s);
  const empty = createWorld("blank", 0, "blank");
  assert.equal(populateWorld(empty), 0);
  assert.equal(s.owner.includes(NEUTRAL), false);
  assert.equal(s.nations.length, 15);
  assert.equal(populateWorld(s), 0);
});

test("established borders claim every island on all geographic maps", () => {
  for (const preset of [
    "earth",
    "europe",
    "asia",
    "africa",
    "oceania",
    "north-america",
    "south-america",
    "islands",
  ]) {
    const s = createWorld("full-map", 6, preset, "borders");
    assert.equal(s.owner.includes(NEUTRAL), false, preset);
    validate(s);
  }
});

test("animation frames replay every annual ownership change to the exact final map", () => {
  const s = createWorld("replay-turn", 12, "arena");
  const owners = [...s.owner];
  const report = advanceTurn(s, 10);
  assert.equal(report.frames.length, 10);
  for (const frame of report.frames)
    for (const change of frame.changes) {
      assert.equal(owners[change.cell], change.from);
      owners[change.cell] = change.to;
    }
  assert.deepEqual(owners, s.owner);
});
