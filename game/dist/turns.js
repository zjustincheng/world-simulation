import { tick, stats, random, log, NEUTRAL } from "./engine.js";

function domesticEvent(s) {
  const territory = stats(s),
    living = s.nations.filter((n) => territory[n.id] > 0);
  if (!s.settings.ai || !living.length || random(s) > 0.55) return;
  const nation = living[Math.floor(random(s) * living.length)],
    event = Math.floor(random(s) * 4);
  if (event === 0) {
    const gain = Math.min(80, 99999 - nation.wealth);
    nation.wealth += gain;
    log(
      s,
      `Trade flourishes in ${nation.name}. Merchants bring ${Math.round(gain)} gold to the treasury.`,
      "prosperity",
    );
  } else if (event === 1) {
    const loss = Math.min(35, nation.wealth);
    nation.wealth -= loss;
    nation.stability = Math.max(5, nation.stability - 4);
    log(
      s,
      `A poor harvest strains ${nation.name}. Relief costs ${Math.round(loss)} gold and unrest grows.`,
      "hardship",
    );
  } else if (event === 2) {
    const cost = Math.min(25, nation.wealth);
    nation.wealth -= cost;
    nation.efficiency = Math.min(150, nation.efficiency + cost / 5);
    log(
      s,
      `Military reforms in ${nation.name} invest ${Math.round(cost)} gold in better training.`,
      "reform",
    );
  } else {
    nation.stability = Math.min(100, nation.stability + 8);
    log(
      s,
      `A council of reconciliation eases tensions in ${nation.name}. Stability improves.`,
      "peace",
    );
  }
}

// One explicit action resolves one year. Rendering and wall-clock time never call tick.
export function advanceTurn(s) {
  const before = stats(s);
  if (!before.some(Boolean))
    throw Error("Place at least one nation before advancing a turn.");
  const owners = [...s.owner],
    gold = s.nations.map((n) => n.wealth);
  tick(s);
  domesticEvent(s);
  const after = stats(s),
    changes = [];
  let claimed = 0,
    transferred = 0;
  s.owner.forEach((owner, cell) => {
    if (owner === owners[cell]) return;
    changes.push({ cell, from: owners[cell], to: owner });
    if (owners[cell] === NEUTRAL && owner >= 0) claimed++;
    else if (owners[cell] >= 0 && owner >= 0) transferred++;
  });
  const nations = s.nations.map((n) => ({
    id: n.id,
    name: n.name,
    color: n.color,
    before: before[n.id] || 0,
    after: after[n.id],
    delta: after[n.id] - (before[n.id] || 0),
    goldDelta: Math.round(n.wealth - (gold[n.id] || 0)),
  }));
  const events = s.events
    .filter((e) => e.year === s.year)
    .map((e) => ({ ...e }));
  const headline =
    [
      "fall",
      "birth",
      "war",
      "battle",
      "hardship",
      "prosperity",
      "reform",
      "peace",
    ]
      .map((type) => events.find((e) => e.type === type))
      .find(Boolean)?.text ||
    (claimed
      ? `${claimed} new tiles are settled as nations expand.`
      : s.settings.ai
        ? "A quiet year. Nations consolidate their holdings."
        : "Nation AI is disabled. No nations acted this turn.");
  return {
    year: s.year,
    claimed,
    transferred,
    changes,
    nations,
    events,
    headline,
  };
}
