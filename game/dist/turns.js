import { tick, stats, random, log, NEUTRAL } from "./engine.js";

function domesticEvent(s, guaranteed = false) {
  const living = s.nations.filter((n) => stats(s)[n.id] > 0);
  if (!s.settings.ai || !living.length || (!guaranteed && random(s) > 0.35))
    return;
  const n = living[Math.floor(random(s) * living.length)];
  const stories = [
    [
      "prosperity",
      "The caravan returns",
      `After months beyond the frontier, merchants reach ${n.name} with laden wagons. Market bells ring as the treasury collects its share.`,
      100,
      2,
      0,
    ],
    [
      "hardship",
      "Empty granaries",
      `Rain fails across ${n.name}. Bakers shutter their shops and the government opens emergency stores to keep the capital fed.`,
      -60,
      -8,
      0,
    ],
    [
      "reform",
      "A new generation of officers",
      `Veterans in ${n.name} abandon old rivalries to train a common officer corps. Drums sound across the parade grounds as recruits learn to fight together.`,
      -45,
      0,
      8,
    ],
    [
      "peace",
      "The lantern council",
      `Delegates from the provinces gather beneath lanterns in ${n.name}. A night of difficult bargaining ends with a public pledge to settle their disputes.`,
      -20,
      12,
      0,
    ],
    [
      "prosperity",
      "Silver in the hills",
      `A prospector brings a glittering sample to the capital of ${n.name}. Within weeks, a quiet hillside becomes a mining camp and royal tax collectors follow.`,
      140,
      0,
      0,
    ],
    [
      "hardship",
      "The missing payroll",
      `Soldiers in ${n.name} open their pay chests and find them short. An inquiry uncovers stolen wages; angry units refuse drills while the treasury makes repairs.`,
      -40,
      -5,
      -6,
    ],
    [
      "reform",
      "The great road",
      `Stonemasons in ${n.name} lay the last stones of a road linking the capital to its outlying towns. Supplies and messengers can finally travel without the old detours.`,
      -65,
      4,
      5,
    ],
    [
      "peace",
      "A festival after the storm",
      `For a few days, the squares of ${n.name} fill with music instead of arguments. Families share food, and officials find a rare chance to rebuild public trust.`,
      -15,
      9,
      0,
    ],
  ];
  const [type, title, story, gold, stability, efficiency] =
    stories[Math.floor(random(s) * stories.length)];
  const before = [n.wealth, n.stability, n.efficiency];
  n.wealth = Math.max(0, Math.min(99999, n.wealth + gold));
  n.stability = Math.max(5, Math.min(100, n.stability + stability));
  n.efficiency = Math.max(5, Math.min(150, n.efficiency + efficiency));
  const effects =
    [n.wealth - before[0], n.stability - before[1], n.efficiency - before[2]]
      .map((v, i) =>
        v
          ? `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10} ${["gold", "stability", "efficiency"][i]}`
          : "",
      )
      .filter(Boolean)
      .join(" · ") || "Already at maximum; no stat change";
  log(s, `${title}. ${story} (${effects})`, type);
}

// A chapter resolves several years, but never advances on wall-clock time.
export function advanceTurn(s, years = 5) {
  if (![1, 5, 10].includes(years))
    throw Error("Choose 1, 5, or 10 years per turn.");
  const startYear = s.year;
  const turnEvents = [];
  const before = stats(s);
  if (!before.some(Boolean))
    throw Error("Place at least one nation before advancing a turn.");
  const owners = [...s.owner],
    gold = s.nations.map((n) => n.wealth);
  for (let i = 0; i < years; i++) {
    tick(s);
    domesticEvent(
      s,
      i === years - 1 &&
        !turnEvents.some((e) =>
          ["prosperity", "hardship", "reform", "peace"].includes(e.type),
        ),
    );
    turnEvents.push(
      ...s.events.filter((e) => e.year === s.year).map((e) => ({ ...e })),
    );
  }
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
  const events = turnEvents.reverse();
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
    startYear,
    years,
    claimed,
    transferred,
    changes,
    nations,
    events,
    headline,
  };
}
