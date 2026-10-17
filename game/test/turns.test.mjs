import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, validate, NEUTRAL } from "../dist/engine.js";
import { advanceTurn } from "../dist/turns.js";

test("each explicit turn advances once and reports exact ownership differences", () => {
  const s = createWorld("turn-expansion", 6, "arena", "seeds");
  const owners = [...s.owner];
  const report = advanceTurn(s);
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
  const report = advanceTurn(s);
  assert.equal(s.year, before.year + 1);
  assert.deepEqual(s.nations, before.nations);
  assert.deepEqual(s.owner, before.owner);
  assert.equal(report.changes.length, 0);
  assert.equal(report.events.length, 0);
});
