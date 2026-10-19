import {
  stats,
  related,
  hasTruce,
  nearbySeaLandings,
  declareWar,
  peace,
  ally,
  log,
} from "./engine.js";
const keyOf = (a, b) => [Math.min(a, b), Math.max(a, b)].join(",");
export function relation(s, a, b, sizes = stats(s)) {
  s.relations ||= {};
  const [first, second] = [Math.min(a, b), Math.max(a, b)];
  return (s.relations[keyOf(a, b)] ||= {
    a: first,
    b: second,
    tension: 0,
    reason: "",
    initiator: first,
    since: s.year,
    stage: 0,
    claims: [0, 0],
    baseline: [sizes[first], sizes[second]],
  });
}
export function recordLoss(s, winner, loser, tiles) {
  const r = relation(s, winner, loser);
  r.claims[loser === r.a ? 0 : 1] += tiles;
  r.claims[winner === r.a ? 0 : 1] = Math.max(
    0,
    r.claims[winner === r.a ? 0 : 1] - tiles,
  );
}
export function settleRelation(s, a, b) {
  const r = relation(s, a, b);
  r.tension = 0;
  r.stage = 0;
  r.reason = "";
  r.since = s.year;
  // The treaty recognizes the new frontier; old territorial claims are relinquished.
  r.claims = [0, 0];
  r.baseline = [stats(s)[r.a], stats(s)[r.b]];
}
export function diplomacyTick(s, borders, coasts, sizes) {
  s.relations ||= {};
  const candidates = new Set(borders.keys());
  // Historical claims can concern nearby islands, but never unreachable overseas rivals.
  for (const [key, r] of Object.entries(s.relations))
    if (
      !candidates.has(key) &&
      r.claims.some(Boolean) &&
      sizes[r.a] &&
      sizes[r.b]
    ) {
      if (
        nearbySeaLandings(s, r.a, r.b, coasts[r.a]).length ||
        nearbySeaLandings(s, r.b, r.a, coasts[r.b]).length
      )
        candidates.add(key);
    }
  for (const [key, r] of Object.entries(s.relations))
    if (!candidates.has(key)) r.tension = Math.max(0, r.tension - 5);
  for (const key of candidates) {
    const [a, b] = key.split(",").map(Number),
      r = relation(s, a, b, sizes);
    if (!sizes[a] || !sizes[b] || related(s.wars, a, b)) continue;
    if (related(s.alliances, a, b) || hasTruce(s, a, b) || !s.settings.wars) {
      r.tension = Math.max(0, r.tension - 8);
      continue;
    }
    const A = s.nations[a],
      B = s.nations[b];
    if (!r.reason) {
      const losses = Math.max(...r.claims);
      if (losses >= 8) {
        r.initiator = r.claims[0] >= r.claims[1] ? a : b;
        r.reason = `${s.nations[r.initiator].name} seeks the return of territory lost to ${s.nations[r.initiator === a ? b : a].name}`;
      } else {
        const growthA = sizes[a] - r.baseline[0],
          growthB = sizes[b] - r.baseline[1];
        if (
          growthA > Math.max(25, r.baseline[0] * 0.35) ||
          growthB > Math.max(25, r.baseline[1] * 0.35)
        ) {
          const expanding = growthA > growthB ? a : b;
          r.initiator = expanding === a ? b : a;
          r.reason = `${s.nations[r.initiator].name} demands limits on ${s.nations[expanding].name}'s expansion along their shared frontier`;
        } else if (
          (borders.get(key)?.length || 0) >= 24 &&
          Math.max(A.aggression, B.aggression) >= 0.86
        ) {
          r.initiator = A.aggression > B.aggression ? a : b;
          r.reason = `the government of ${s.nations[r.initiator].name} pursues a revision of the settled border with ${s.nations[r.initiator === a ? b : a].name}`;
        }
      }
      if (!r.reason) {
        // A shared enemy can motivate a defensive alliance; mere proximity cannot.
        const enemies = (id) =>
          s.wars
            .filter((p) => p[0] === id || p[1] === id)
            .map((p) => (p[0] === id ? p[1] : p[0]));
        const common = enemies(a).find((id) => enemies(b).includes(id));
        if (s.settings.alliances && common !== undefined) {
          ally(s, a, b);
          log(
            s,
            `A defensive compact. ${A.name} and ${B.name} coordinate against their common enemy, ${s.nations[common].name}.`,
            "peace",
          );
        }
        continue;
      }
      r.since = s.year;
      r.stage = 0;
    }
    const attacker = s.nations[r.initiator],
      target = r.initiator === a ? b : a;
    const alreadyFighting = s.wars.some(
      (p) => p[0] === attacker.id || p[1] === attacker.id,
    );
    if (alreadyFighting || attacker.wealth < 60 || attacker.stability < 45) {
      r.tension = Math.max(0, r.tension - 5);
      continue;
    }
    r.tension = Math.min(100, r.tension + 4 * s.settings.aggression);
    if (r.stage === 0 && r.tension >= 24) {
      r.stage = 1;
      log(
        s,
        `A frontier dispute. In year ${s.year}, ${r.reason}. Both governments receive formal diplomatic notes; no war has begun.`,
        "crisis",
      );
    }
    if (r.stage === 1 && r.tension >= 48) {
      r.stage = 2;
      log(
        s,
        `Negotiations open. The dispute first raised in year ${r.since} brings ${A.name} and ${B.name} to talks. The central issue remains that ${r.reason}.`,
        "crisis",
      );
    }
    const ratio =
      ((sizes[attacker.id] + 40) * attacker.efficiency) /
      ((sizes[target] + 40) * s.nations[target].efficiency);
    if (
      r.stage >= 2 &&
      r.tension >= 60 &&
      (ratio < 0.7 || attacker.aggression < 0.8)
    ) {
      log(
        s,
        `A negotiated settlement. After ${s.year - r.since} years of dispute, ${A.name} and ${B.name} recognize the current frontier. ${attacker.name} abandons its demand rather than risk a costly war; a 15-year non-aggression pact follows.`,
        "peace",
      );
      settleRelation(s, a, b);
      s.truces.push([a, b, s.year + 15]);
      continue;
    }
    if (r.stage === 2 && r.tension >= 76) {
      r.stage = 3;
      log(
        s,
        `Mobilization follows failed talks. ${attacker.name} prepares an ultimatum to ${s.nations[target].name}. The dispute dating to year ${r.since} is now a military crisis, though war is not yet inevitable.`,
        "crisis",
      );
    }
    if (
      r.stage === 3 &&
      r.tension >= 100 &&
      s.year - r.since >= 12 &&
      ratio >= 0.7
    ) {
      declareWar(s, attacker.id, target, {
        force: false,
        reason: `${r.reason}; negotiations and an ultimatum failed after ${s.year - r.since} years of escalating dispute`,
      });
    }
  }
}
export function considerSettlement(s, a, b, started, sizes) {
  const age = s.year - started;
  if (age < 8) return;
  const record = (s.warHistory || []).findLast(
    (r) => r.ended === null && r.a === a && r.b === b,
  );
  const initial = record?.initial || [sizes[a], sizes[b]];
  const gains = s.warStats?.[keyOf(a, b)] || [0, 0];
  const decisive =
    Math.abs(gains[0] - gains[1]) >= Math.max(20, Math.min(...initial) * 0.35);
  const exhausted = [a, b].some(
    (id) => s.nations[id].wealth < 25 || s.nations[id].stability < 35,
  );
  if (decisive || exhausted || age >= 24) {
    peace(s, a, b, {
      reason: decisive
        ? "A substantial territorial shift brings the governments to terms"
        : exhausted
          ? "An exhausted government can no longer sustain the campaign"
          : "Neither government secures a decisive settlement after a generation of fighting",
    });
  }
}
