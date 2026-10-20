import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  tick,
  validate,
  declareWar,
  peace,
  ally,
  hasTruce,
  rebel,
  allianceMembers,
} from "../dist/engine.js";
import { relation } from "../dist/diplomacy.js";
function world() {
  const s = createWorld("historical-diplomacy", 2, "arena", "borders");
  s.settings.revolts = false;
  s.settings.expansion = false;
  s.nations.forEach((n) => {
    n.aggression = 0.6;
    n.wealth = 300;
  });
  return s;
}
test("stable neighbors remain at peace for centuries with no arbitrary declarations", () => {
  const s = world();
  for (let i = 0; i < 200; i++) tick(s);
  assert.equal(s.wars.length, 0);
  assert.equal(s.warHistory.length, 0);
  assert.equal(
    s.events.some((e) => e.type === "war"),
    false,
  );
  assert.equal(declareWar(s, 0, 1, { force: false }), false);
});
test("territorial policy escalates through a dispute, talks and mobilization before war", () => {
  const s = world();
  s.nations[0].aggression = 0.95;
  const stages = [];
  for (let i = 0; i < 40 && !s.wars.length; i++) {
    tick(s);
    for (const e of s.events.filter((e) => e.year === s.year)) stages.push(e);
  }
  assert.equal(s.wars.length, 1);
  assert.ok(stages.find((e) => e.text.startsWith("A frontier dispute.")));
  assert.ok(stages.find((e) => e.text.startsWith("Negotiations open.")));
  assert.ok(stages.find((e) => e.text.startsWith("Mobilization follows")));
  assert.ok(s.warHistory[0].reason.includes("revision of the settled border"));
  assert.ok(s.warHistory[0].started >= 25);
  assert.ok(
    stages.find((e) => e.type === "war").year >
      stages.find((e) => e.text.startsWith("Mobilization")).year,
  );
  validate(s);
});
test("negotiation can settle a grievance without fighting and preserves the pact", () => {
  const s = world(),
    r = relation(s, 0, 1);
  r.claims = [20, 0];
  for (let i = 0; i < 20 && !hasTruce(s, 0, 1); i++) tick(s);
  assert.ok(hasTruce(s, 0, 1));
  assert.equal(s.warHistory.length, 0);
  assert.deepEqual(s.relations["0,1"].claims, [0, 0]);
  assert.ok(
    s.events.some((e) => e.text.startsWith("A negotiated settlement.")),
  );
  const settlements = s.events.filter((e) =>
    e.text.startsWith("A negotiated settlement."),
  ).length;
  for (let i = 0; i < 20; i++) tick(s);
  assert.equal(hasTruce(s, 0, 1), false);
  assert.equal(
    s.events.filter((e) => e.text.startsWith("A negotiated settlement."))
      .length,
    settlements,
  );
  assert.ok(s.relations["0,1"].napUntil > s.year);
  validate(s);
});

test("neighboring states form a balance-of-power coalition against a hegemon", () => {
  const s = createWorld("balance-of-power", 5, "arena");
  s.settings.expansion = false;
  s.settings.revolts = false;
  s.owner = s.owner.map((owner) => (owner < 0 ? owner : 0));
  for (const n of s.nations.slice(1)) s.owner[n.capital] = n.id;
  tick(s);
  const coalition = allianceMembers(s, 1);
  assert.ok(coalition.length >= 1);
  assert.ok(!coalition.includes(0));
  assert.ok(
    s.events.some((event) =>
      event.text.startsWith("A balance-of-power coalition"),
    ),
  );
  validate(s);
});
test("alliances, the single-war rule and an empty treasury restrain declarations", () => {
  for (const mode of ["alliance", "treasury"]) {
    const s = world();
    s.nations[0].aggression = 0.95;
    if (mode === "alliance") ally(s, 0, 1);
    for (let i = 0; i < 50; i++) {
      if (mode === "treasury") s.nations[0].wealth = 0;
      tick(s);
    }
    assert.equal(s.wars.length, 0);
  }
  const s = createWorld("fronts", 4, "arena");
  s.settings.revolts = false;
  declareWar(s, 0, 1);
  assert.equal(declareWar(s, 0, 2), false);
  assert.equal(s.wars.length, 1);
  const r = relation(s, 0, 3);
  r.reason = "a territorial claim";
  r.initiator = 0;
  r.stage = 3;
  r.tension = 100;
  r.since = 1;
  s.year = 30;
  tick(s);
  assert.equal(
    s.wars.some((p) => p[0] === 0 && p[1] === 3),
    false,
  );
});
test("recent war leaders leave room for another country's dispute to take priority", () => {
  const s = createWorld("recent-aggressor", 4, "arena");
  s.settings.revolts = false;
  s.settings.expansion = false;
  s.nations.forEach((n) => {
    n.aggression = 0.6;
    n.wealth = 300;
  });
  declareWar(s, 0, 1, { reason: "a test campaign" });
  peace(s, 0, 1);
  s.year = 20;
  const r = relation(s, 0, 2);
  r.reason = "a territorial claim";
  r.initiator = 0;
  r.stage = 3;
  r.tension = 100;
  r.since = 1;
  tick(s);
  assert.equal(s.wars.length, 0);
});
test("war outcomes end prolonged fighting and remain in the saved historical record", () => {
  const s = world();
  declareWar(s, 0, 1, { reason: "a disputed frontier treaty" });
  for (let i = 0; i < 25 && s.wars.length; i++) tick(s);
  assert.equal(s.wars.length, 0);
  assert.ok(s.warHistory[0].ended);
  assert.ok(s.warHistory[0].outcome.includes("gain"));
  assert.equal(s.warHistory[0].reason, "a disputed frontier treaty");
  const restored = validate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.warHistory, s.warHistory);
  tick(s);
  tick(restored);
  assert.deepEqual(s, restored);
});
test("player interventions and independence wars state their distinct causes", () => {
  const s = world();
  declareWar(s, 0, 1);
  assert.match(s.warHistory[0].reason, /player/);
  peace(s, 0, 1);
  rebel(s, 0);
  assert.match(s.warHistory.at(-1).reason, /independence/);
});
test("old saves acquire diplomacy memory and malformed records are rejected", () => {
  const s = world();
  delete s.relations;
  delete s.warHistory;
  const migrated = validate(s);
  assert.deepEqual(migrated.relations, {});
  assert.deepEqual(migrated.warHistory, []);
  const r = relation(migrated, 0, 1);
  r.tension = Infinity;
  assert.throws(() => validate(migrated));
  const other = world();
  declareWar(other, 0, 1);
  other.warHistory[0].initiator = 99;
  assert.throws(() => validate(other));
});

test("expansion and a broken alliance create specific remembered grievances", () => {
  const s = world();
  const r = relation(s, 0, 1);
  r.baseline[0] = 100;
  tick(s);
  assert.match(s.relations["0,1"].reason, /expansion/);
  const other = world();
  ally(other, 0, 1);
  ally(other, 0, 1);
  assert.match(other.relations["0,1"].reason, /ended their alliance/);
  assert.equal(other.relations["0,1"].initiator, 1);
  assert.equal(other.wars.length, 0);
  validate(other);
});
