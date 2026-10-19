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
    [
      "hardship",
      "Fire in the old quarter",
      `A night watchman raises the alarm in ${n.name}. Neighbors form bucket lines, but rebuilding the crowded streets will draw heavily on public funds.`,
      -85,
      -4,
      0,
    ],
    [
      "prosperity",
      "The master glassmakers",
      `Artisans in ${n.name} perfect a clear glass prized by distant buyers. Workshops glow late into the night as orders bring new wealth to the capital.`,
      90,
      3,
      0,
    ],
    [
      "reform",
      "Maps of the frontier",
      `Surveyors return to ${n.name} with charts of mountain passes and river crossings. Commanders replace their faded maps and rehearse new supply routes.`,
      -35,
      0,
      7,
    ],
    [
      "hardship",
      "A winter without end",
      `Snow seals the roads of ${n.name}. Relief wagons inch toward isolated towns while exhausted garrisons burn their last reserve of firewood.`,
      -70,
      -6,
      -3,
    ],
    [
      "peace",
      "The open courthouse",
      `Petitioners in ${n.name} are invited to challenge corrupt officials before public judges. Several powerful families lose favor, but the hearings restore confidence in the law.`,
      -30,
      10,
      0,
    ],
    [
      "prosperity",
      "The harvest fair",
      `Full barns bring traders to ${n.name}. The harvest fair spills beyond the city gates, and a modest levy on the crowded stalls fills the treasury.`,
      75,
      5,
      0,
    ],
    [
      "hardship",
      "Rumors in the palace",
      `Contradictory orders emerge from the court of ${n.name}. Ministers accuse each other of plotting, and provincial officers hesitate while the capital argues.`,
      -20,
      -10,
      -4,
    ],
    [
      "reform",
      "The field hospitals",
      `Surgeons in ${n.name} organize mobile treatment tents and train new attendants. Returning soldiers speak of comrades saved, though the equipment comes at a price.`,
      -55,
      3,
      6,
    ],
    [
      "peace",
      "The scholar's petition",
      `Teachers in ${n.name} ask the court to open a public school. A small grant turns an unused hall into classrooms, and families welcome the promise of a different future.`,
      -40,
      7,
      0,
    ],
    [
      "prosperity",
      "A better waterwheel",
      `Millwrights in ${n.name} demonstrate a wheel that works even in a gentle current. Flour reaches the markets faster and the court receives a share of the new profits.`,
      110,
      2,
      0,
    ],
    [
      "hardship",
      "The broken bridge",
      `The main bridge in ${n.name} gives way under a supply convoy. Ferrymen keep the towns connected while engineers begin expensive repairs.`,
      -55,
      -3,
      -5,
    ],
    [
      "reform",
      "A common signal",
      `Messengers in ${n.name} introduce a shared code of flags and beacons. Distant garrisons can now exchange orders without waiting days for a rider.`,
      -40,
      0,
      9,
    ],
  ];
  const atWar = s.wars.some((p) => p[0] === n.id || p[1] === n.id);
  const eligible = stories.filter(
    ([type, title, , gold]) =>
      !(type === "peace" && atWar) &&
      !(gold < 0 && type !== "hardship" && n.wealth < -gold) &&
      !s.events
        .slice(0, 30)
        .some((e) => e.text.startsWith(`${title}.`) && e.text.includes(n.name)),
  );
  if (!eligible.length) return;
  const [type, title, story, gold, stability, efficiency] =
    eligible[Math.floor(random(s) * eligible.length)];
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
  const frames = [];
  const before = stats(s);
  if (!before.some(Boolean))
    throw Error("Place at least one nation before advancing a turn.");
  const owners = [...s.owner],
    gold = s.nations.map((n) => n.wealth);
  for (let i = 0; i < years; i++) {
    const previousOwners = [...s.owner];
    tick(s);
    domesticEvent(
      s,
      i === years - 1 &&
        !turnEvents.some((e) =>
          ["prosperity", "hardship", "reform", "peace"].includes(e.type),
        ),
    );
    const annualChanges = s.owner.flatMap((to, cell) =>
      to === previousOwners[cell]
        ? []
        : [{ cell, from: previousOwners[cell], to }],
    );
    const annualEvents = s.events
      .filter((e) => e.year === s.year)
      .map((e) => ({ ...e, changes: [] }))
      .reverse();
    const campaigns = new Map();
    for (const change of annualChanges) {
      const key = `${change.from},${change.to}`;
      if (!campaigns.has(key)) campaigns.set(key, []);
      campaigns.get(key).push(change);
    }
    // Each dispatch owns exactly the territory changes it describes.
    for (const [key, changes] of campaigns) {
      const [from, to] = key.split(",").map(Number),
        tiles = changes.length;
      const secession = to >= 0 && s.nations[to].born === s.year && from >= 0;
      log(
        s,
        secession
          ? `Secession redraws the frontier. ${s.nations[to].name} establishes a breakaway administration across ${tiles} tiles formerly governed by ${s.nations[from].name}. The transfer marks a declaration of independence, whose survival is not yet assured.`
          : to < 0
            ? `An abandoned frontier. ${s.nations[from].name} loses control of ${tiles} tiles. These lands are now unclaimed.`
            : from >= 0
              ? `The frontier shifts. ${s.nations[to].name} takes ${tiles} tiles from ${s.nations[from].name} during this year's fighting. Local administration passes to the occupying government, while the former rulers lose revenue and recruiting ground.`
              : `A new frontier opens. Settlers from ${s.nations[to].name} establish control over ${tiles} unclaimed tiles this year. The new settlements extend the capital’s tax base and bring its authority closer to neighboring states.`,
        secession ? "birth" : from >= 0 ? "battle" : "expansion",
      );
      annualEvents.push({ ...s.events[0], changes });
    }
    frames.push({ year: s.year, changes: annualChanges });
    turnEvents.push(...annualEvents);
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
      "crisis",
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
    frames,
    years,
    claimed,
    transferred,
    changes,
    nations,
    events,
    headline,
  };
}

// Seek the next historical turning point. The bound only prevents endless searches
// in stable worlds; it is not a chosen turn length.
export function advanceToMajorEvent(s) {
  const before = stats(s);
  if (!before.some(Boolean)) throw Error("Place at least one nation first.");
  const startYear = s.year,
    owners = [...s.owner],
    gold = s.nations.map((n) => n.wealth);
  const frames = [],
    developments = [];
  let milestone = "quiet";
  if (s.settings.ai)
    for (let elapsed = 1; elapsed <= 30; elapsed++) {
      const previous = [...s.owner];
      tick(s);
      domesticEvent(s);
      const annual = s.events.filter((e) => e.year === s.year);
      const important = annual.filter(
        (e) =>
          ["war", "fall", "birth", "crisis", "battle"].includes(e.type) ||
          (e.type === "peace" &&
            /settlement|truce|compact|alliance|accord/i.test(e.text)),
      );
      developments.push(...important);
      frames.push({
        year: s.year,
        changes: s.owner.flatMap((to, cell) =>
          to === previous[cell] ? [] : [{ cell, from: previous[cell], to }],
        ),
      });
      if (important.length) {
        milestone = "development";
        break;
      }
      const changed = s.owner.reduce(
        (sum, to, cell) =>
          sum + (to !== owners[cell] && to >= 0 && owners[cell] >= 0 ? 1 : 0),
        0,
      );
      const settled = s.owner.reduce(
        (sum, to, cell) => sum + (owners[cell] === NEUTRAL && to >= 0 ? 1 : 0),
        0,
      );
      // Campaigns collect several years of skirmishes into a meaningful net shift.
      if (
        elapsed >= 3 &&
        changed >= Math.max(40, before.reduce((a, b) => a + b, 0) * 0.025)
      ) {
        milestone = "campaign";
        break;
      }
      if (settled >= Math.max(100, before.reduce((a, b) => a + b, 0) * 0.25)) {
        milestone = "expansion";
        break;
      }
    }
  const after = stats(s),
    changes = s.owner.flatMap((to, cell) =>
      to === owners[cell] ? [] : [{ cell, from: owners[cell], to }],
    );
  const nations = s.nations.map((n) => ({
    id: n.id,
    name: n.name,
    color: n.color,
    before: before[n.id] || 0,
    after: after[n.id],
    delta: after[n.id] - (before[n.id] || 0),
    goldDelta: Math.round(n.wealth - (gold[n.id] || 0)),
  }));
  const claimed = changes.filter((c) => c.from === NEUTRAL && c.to >= 0).length;
  const transferred = changes.filter((c) => c.from >= 0 && c.to >= 0).length;
  const priority = ["fall", "birth", "peace", "war", "crisis", "battle"];
  developments.sort(
    (a, b) => priority.indexOf(a.type) - priority.indexOf(b.type),
  );
  const main = developments[0];
  const title = main
    ? main.text.split(". ")[0]
    : milestone === "campaign"
      ? "A campaign reshapes the frontier"
      : milestone === "expansion"
        ? "An era of settlement"
        : s.settings.ai
          ? "An era of relative calm"
          : "History is paused";
  const elapsed = s.year - startYear;
  const time = elapsed
    ? `${elapsed === 1 ? "One year has" : `${elapsed} years have`} passed since the last event.`
    : "Nation AI is disabled. Enable it in Settings to advance history.";
  const account = main
    ? [...new Set(developments.slice(0, 3).map((e) => e.text))].join(" ") +
      (developments.length > 3
        ? ` Another ${developments.length - 3} developments are recorded in History.`
        : "")
    : milestone === "campaign"
      ? "Several seasons of fighting have produced a substantial shift in the balance of territory."
      : milestone === "expansion"
        ? "Continued settlement brings a substantial area of unclaimed land under national administration."
        : s.settings.ai
          ? "No major political turning point occurred during this interval. The existing order endured; routine economic and local developments continued."
          : "";
  const movers = nations
    .filter((n) => n.delta)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const territory = movers.length
    ? ` Territorial balance: ${movers
        .slice(0, 3)
        .map(
          (n) =>
            `${n.name} ${n.delta > 0 ? "gained" : "lost"} ${Math.abs(n.delta)} tiles`,
        )
        .join(
          "; ",
        )}${movers.length > 3 ? `; ${movers.length - 3} other nations also changed size` : ""}.`
    : " The overall territorial balance is unchanged.";
  const text = `${title}. ${time} ${main ? account.slice(main.text.split(". ")[0].length + 2) : account}${territory}`;
  const event = {
    year: s.year,
    type:
      main?.type ||
      (milestone === "campaign"
        ? "battle"
        : milestone === "expansion"
          ? "expansion"
          : "world"),
    text,
    changes,
  };
  if (elapsed) log(s, text.slice(0, 999), "chapter");
  return {
    year: s.year,
    startYear,
    years: elapsed,
    frames,
    claimed,
    transferred,
    changes,
    nations,
    events: [event],
    headline: title,
    milestone,
  };
}
