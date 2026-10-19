import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, validate, declareWar, ally } from "../dist/engine.js";
import { advanceToMajorEvent } from "../dist/turns.js";
function scenario() {
  const s = createWorld("major-events", 2, "arena");
  s.settings.revolts = false;
  s.settings.expansion = false;
  s.nations.forEach((n) => {
    n.aggression = 0.6;
    n.wealth = 500;
  });
  return s;
}
test("world chapters continue beyond early notices to a substantial outcome", () => {
  const s = scenario();
  s.nations[0].aggression = 0.95;
  const report = advanceToMajorEvent(s);
  assert.equal(report.events.length, 1);
  assert.equal(report.milestone, "development");
  assert.ok(report.years > 6 && report.years <= 60);
  assert.ok(
    report.transferred > 0 || s.warHistory.some((r) => r.ended !== null),
  );
  assert.ok(report.roundup.wars.length > 0);
  assert.ok(report.roundup.wars.every((w) => w.text.startsWith("War ended")));
  for (const war of s.warHistory.filter((r) => r.started > report.startYear)) {
    assert.ok(war.ended !== null);
    assert.ok(report.frames.some((f) => f.year === war.started));
    assert.ok(report.frames.some((f) => f.year === war.ended));
  }
  assert.match(report.events[0].text, /years have passed/);
});
test("quiet worlds return a calm-era summary and disabled AI does not advance", () => {
  const s = scenario();
  const report = advanceToMajorEvent(s);
  assert.equal(report.milestone, "quiet");
  assert.equal(report.years, 60);
  assert.match(report.events[0].text, /No major political turning point/);
  s.settings.ai = false;
  const before = structuredClone(s);
  const paused = advanceToMajorEvent(s);
  assert.equal(paused.years, 0);
  assert.deepEqual(s, before);
});
test("campaigns produce one summary and exact final borders, including saved deterministic futures", () => {
  const s = scenario();
  declareWar(s, 0, 1, { reason: "a disputed frontier" });
  const saved = validate(JSON.parse(JSON.stringify(s))),
    owners = [...s.owner];
  const report = advanceToMajorEvent(s);
  assert.deepEqual(report, advanceToMajorEvent(saved));
  assert.deepEqual(s, saved);
  assert.equal(report.events.length, 1);
  for (const change of report.events[0].changes) {
    assert.equal(owners[change.cell], change.from);
    owners[change.cell] = change.to;
  }
  assert.deepEqual(owners, s.owner);
  assert.ok(report.years > 1);
  assert.ok(!s.events.some((e) => e.text.startsWith("The frontier shifts.")));
  validate(s);
});
test("settlement summaries and expansion milestones are reachable without year controls", () => {
  const s = scenario();
  declareWar(s, 0, 1);
  let found = false;
  for (let i = 0; i < 30; i++) {
    const report = advanceToMajorEvent(s);
    if (s.warHistory[0].ended) {
      assert.ok(
        report.roundup.wars.some((w) => w.text.startsWith("War ended")),
      );
      found = true;
      break;
    }
  }
  assert.ok(found);
  const expanding = createWorld("growth-event", 6, "arena", "seeds");
  expanding.settings.wars = false;
  expanding.settings.revolts = false;
  assert.equal(advanceToMajorEvent(expanding).milestone, "expansion");
});

test("world roundup includes simultaneous conflicts and alliances across countries", () => {
  const s = createWorld("world-roundup", 4, "arena");
  s.settings.wars = false;
  s.settings.revolts = false;
  ally(s, 0, 2);
  declareWar(s, 0, 1, { reason: "a western border dispute" });
  declareWar(s, 2, 3, { reason: "an eastern independence claim" });
  const owners = [...s.owner];
  const report = advanceToMajorEvent(s);
  assert.ok(report.roundup.wars.length >= 2);
  assert.ok(report.roundup.wars.every((w) => w.text.startsWith("War ended")));
  assert.ok(report.roundup.wars.some((w) => w.text.includes("western border")));
  assert.ok(
    report.roundup.wars.some((w) => w.text.includes("eastern independence")),
  );
  assert.ok(
    report.roundup.alliances.some(
      (a) =>
        a.title.includes(s.nations[0].name) &&
        a.title.includes(s.nations[2].name),
    ),
  );
  assert.ok(report.years >= 6);
  assert.ok(report.transferred > 40);
  for (const change of report.changes) owners[change.cell] = change.to;
  assert.deepEqual(owners, s.owner);
  validate(s);
});
