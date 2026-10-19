import {
  relation,
  recordLoss,
  settleRelation,
  diplomacyTick,
  considerSettlement,
} from "./diplomacy.js";
// Deterministic tile simulation. -1 = water, -2 = unclaimed land.
import { REAL_MAPS } from "./real-maps.js";
import { generateNationName } from "./names.js";
export const W = 160,
  H = 100,
  WATER = -1,
  NEUTRAL = -2,
  MAX_NATIONS = 64;
export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
export const TECH_PROGRESS_REQUIRED = 48;
export const GOVERNMENTS = [
  {
    id: "feudal-monarchy",
    name: "Feudal Monarchy",
    offense: 0.04,
    defense: 0.06,
    economy: 0,
    stability: 0.06,
  },
  {
    id: "elective-monarchy",
    name: "Elective Monarchy",
    offense: 0.04,
    defense: 0.02,
    economy: 0.05,
    stability: 0.03,
  },
  {
    id: "merchant-republic",
    name: "Merchant Republic",
    offense: 0,
    defense: 0,
    economy: 0.14,
    stability: 0,
  },
  {
    id: "tribal-confederation",
    name: "Tribal Confederation",
    offense: 0.08,
    defense: 0.03,
    economy: -0.04,
    stability: -0.02,
  },
  {
    id: "theocracy",
    name: "Theocracy",
    offense: 0,
    defense: 0.04,
    economy: 0,
    stability: 0.1,
  },
  {
    id: "council-state",
    name: "Council State",
    offense: 0.02,
    defense: 0.02,
    economy: 0.06,
    stability: 0.02,
  },
];
export const RELIGIONS = [
  "Hearth Faith",
  "Old Ways",
  "Sun Creed",
  "River Rite",
  "Sky Covenant",
  "Moon Temple",
];
export const governmentProfile = (nation) =>
  GOVERNMENTS.find((government) => government.id === nation.government) ||
  GOVERNMENTS[0];
export const governmentName = (nation) => governmentProfile(nation).name;
const governmentBonus = (nation, key) => governmentProfile(nation)[key] || 0;
function climateRoll(s, cell, seasonIndex) {
  const y = Math.floor(cell / W),
    latitude = Math.abs(y / H - 0.5) * 2;
  let hash = Math.imul((s.rng ^ (cell + 1)) >>> 0, 2654435761);
  hash ^= Math.imul((s.year + seasonIndex * 37) >>> 0, 2246822519);
  const roll = (hash >>> 0) / 4294967296;
  const winter = seasonIndex === 3,
    summer = seasonIndex === 1;
  if (winter && latitude > 0.42 && roll < 0.42) return "snow";
  if (summer && latitude > 0.45 && roll < 0.22) return "storm";
  if (roll < 0.12) return "fog";
  if (roll < 0.34) return "rain";
  if (roll < 0.39) return "storm";
  return "clear";
}
function seasonalOutlook(s) {
  const cell = s.owner.findIndex((owner) => owner >= 0);
  return SEASONS.map((season, index) => ({
    season,
    weather: cell < 0 ? "clear" : climateRoll(s, cell, index),
  }));
}
export const TECHNOLOGY_AGES = [
  {
    name: "Medieval",
    technologies: [
      {
        id: "three-field",
        name: "Three-field rotation",
        effect: "Food surpluses support faster growth and income.",
        economy: 0.25,
      },
      {
        id: "stirrups",
        name: "Warhorse breeding",
        effect: "Mounted forces gain an edge in open battles.",
        offense: 0.1,
      },
      {
        id: "stone-keeps",
        name: "Stone keeps",
        effect: "Fortified high ground is harder to take.",
        defense: 0.14,
      },
      {
        id: "counterweight",
        name: "Counterweight trebuchets",
        effect: "Siege trains take more ground after a victory.",
        siege: 0.12,
      },
      {
        id: "monastic-schools",
        name: "Monastic schools",
        effect: "Scriptoria preserve maps, law, and learning across the realm.",
        economy: 0.08,
      },
      {
        id: "irrigation",
        name: "Canal irrigation",
        effect: "Waterworks improve harvests and state revenue.",
        economy: 0.12,
      },
    ],
  },
  {
    name: "Renaissance",
    technologies: [
      {
        id: "field-drill",
        name: "Field drill",
        effect: "Regular training improves army strength.",
        offense: 0.12,
      },
      {
        id: "surveyors",
        name: "Royal surveyors",
        effect: "Better surveys improve trade and taxation.",
        economy: 0.22,
      },
      {
        id: "trace-italienne",
        name: "Bastion fortifications",
        effect: "New defenses make rough terrain still costlier to cross.",
        defense: 0.18,
      },
      {
        id: "matchlocks",
        name: "Matchlock companies",
        effect: "Early firearms strengthen disciplined armies.",
        offense: 0.14,
      },
      {
        id: "printing-press",
        name: "Movable-type printing",
        effect: "Printed manuals and pamphlets spread ideas more quickly.",
        economy: 0.1,
      },
      {
        id: "oceanic-charts",
        name: "Oceanic charts",
        effect: "Improved navigation strengthens overseas logistics.",
        siege: 0.06,
      },
    ],
  },
  {
    name: "Industrial",
    technologies: [
      {
        id: "rail",
        name: "Military railways",
        effect: "Supply lines sustain larger campaigns.",
        offense: 0.13,
      },
      {
        id: "telegraph",
        name: "Telegraph network",
        effect: "Faster coordination improves battlefield command.",
        offense: 0.1,
      },
      {
        id: "mass-production",
        name: "Mass production",
        effect: "Mechanized workshops increase state revenue.",
        economy: 0.3,
      },
      {
        id: "modern-forts",
        name: "Modern fortifications",
        effect: "Prepared positions hold against larger assaults.",
        defense: 0.2,
      },
      {
        id: "steam-engine",
        name: "Steam engine",
        effect: "Steam power expands workshops and national income.",
        economy: 0.16,
      },
      {
        id: "industrial-medicine",
        name: "Industrial medicine",
        effect: "Public sanitation helps cities sustain larger populations.",
        economy: 0.08,
      },
    ],
  },
  {
    name: "Modern",
    technologies: [
      {
        id: "radar",
        name: "Radar networks",
        effect: "Early warning systems strengthen defensive coordination.",
        defense: 0.12,
      },
      {
        id: "jet-aircraft",
        name: "Jet aircraft",
        effect: "Rapid air support increases the tempo of offensives.",
        offense: 0.12,
      },
      {
        id: "nuclear-energy",
        name: "Nuclear energy",
        effect: "New power stations fuel a more productive economy.",
        economy: 0.18,
      },
      {
        id: "mechanized-infantry",
        name: "Mechanized infantry",
        effect: "Armored transport improves battlefield mobility.",
        siege: 0.1,
      },
      {
        id: "antibiotics",
        name: "Antibiotics",
        effect: "Modern medicine keeps more workers and soldiers alive.",
        economy: 0.1,
      },
      {
        id: "missile-defense",
        name: "Missile defense",
        effect: "Layered defenses make fortified regions harder to overwhelm.",
        defense: 0.12,
      },
      {
        id: "combined-arms",
        name: "Combined-arms doctrine",
        effect: "Coordinated forces gain a decisive combat advantage.",
        offense: 0.16,
      },
      {
        id: "air-recon",
        name: "Aerial reconnaissance",
        effect: "Reconnaissance improves the tempo of attacks.",
        siege: 0.12,
      },
      {
        id: "logistics",
        name: "Motorized logistics",
        effect: "Modern supply networks support prosperous armies.",
        economy: 0.25,
      },
      {
        id: "communications",
        name: "Secure field communications",
        effect: "Reliable communications improve defensive coordination.",
        defense: 0.18,
      },
    ],
  },
  {
    name: "Information",
    technologies: [
      {
        id: "satellites",
        name: "Reconnaissance satellites",
        effect: "Global surveillance improves military command.",
        offense: 0.1,
      },
      {
        id: "digital-networks",
        name: "Digital networks",
        effect: "Connected markets increase productivity and state revenue.",
        economy: 0.16,
      },
      {
        id: "precision-weapons",
        name: "Precision weapons",
        effect: "Accurate strikes make successful offensives more effective.",
        siege: 0.12,
      },
      {
        id: "drones",
        name: "Uncrewed reconnaissance",
        effect: "Persistent scouting helps commanders prepare defenses.",
        defense: 0.1,
      },
      {
        id: "automated-industry",
        name: "Automated industry",
        effect: "Automation raises output across the economy.",
        economy: 0.16,
      },
      {
        id: "integrated-command",
        name: "Integrated command systems",
        effect: "Real-time coordination improves force effectiveness.",
        offense: 0.1,
      },
    ],
  },
];
export const technologyName = (n) => TECHNOLOGY_AGES[n.tech?.age || 0].name;
export const technologyBonus = (n, key) =>
  TECHNOLOGY_AGES.flatMap((age) => age.technologies)
    .filter((tech) => n.tech?.unlocked?.includes(tech.id))
    .reduce((sum, tech) => sum + (tech[key] || 0), 0);
export const colors = [
  "#ed695e",
  "#58bda0",
  "#679aeb",
  "#dda84f",
  "#b987e5",
  "#d577b1",
  "#90bd5b",
  "#57c5d4",
  "#e68a49",
  "#a7a5ed",
  "#a7ca85",
  "#d3b182",
];
// Extend the palette without repeating a founding nation's exact color.
for (let id = colors.length; id < MAX_NATIONS; id++) {
  const hue = (id * 137.508) % 360,
    saturation = 0.54,
    lightness = 0.55 + (id % 3) * 0.035;
  const a = saturation * Math.min(lightness, 1 - lightness);
  colors.push(
    "#" +
      [0, 8, 4]
        .map((offset) => {
          const k = (offset + hue / 30) % 12;
          return Math.round(
            255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
          )
            .toString(16)
            .padStart(2, "0");
        })
        .join(""),
  );
}
const defaults = {
  ai: true,
  wars: true,
  alliances: true,
  revolts: true,
  expansion: true,
  aggression: 1,
};
const adjacent = Array.from({ length: W * H }, (_, i) =>
  [
    i % W > 0 ? i - 1 : -1,
    i % W < W - 1 ? i + 1 : -1,
    i >= W ? i - W : -1,
    i < W * (H - 1) ? i + W : -1,
  ].filter((j) => j >= 0),
);
export const neighbors = (i) => adjacent[i] || [];
export function random(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, values) => values[Math.floor(random(s) * values.length)];
const pair = (a, b) => [Math.min(a, b), Math.max(a, b)];
export const related = (list, a, b) =>
  list.some((p) => p[0] === Math.min(a, b) && p[1] === Math.max(a, b));
export function alliancePath(s, a, b) {
  const queue = [a],
    previous = new Map([[a, null]]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current === b) break;
    for (const [left, right] of s.alliances || []) {
      const next = left === current ? right : right === current ? left : -1;
      if (next >= 0 && !previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(b)) return [];
  const path = [];
  for (let current = b; current !== a; current = previous.get(current))
    path.push([
      Math.min(current, previous.get(current)),
      Math.max(current, previous.get(current)),
    ]);
  return path;
}
export const allied = (s, a, b) => a !== b && alliancePath(s, a, b).length > 0;
export function allianceMembers(s, id) {
  const members = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of s.alliances || [])
      if (members.has(a) && !members.has(b)) {
        members.add(b);
        changed = true;
      } else if (members.has(b) && !members.has(a)) {
        members.add(a);
        changed = true;
      }
  }
  members.delete(id);
  return [...members];
}
export function log(s, text, type = "world") {
  s.events.unshift({ year: s.year, text, type });
  s.events.length = Math.min(s.events.length, 150);
}
function research(s, n, territory) {
  n.tech ||= { age: 0, progress: 0, unlocked: [] };
  const age = TECHNOLOGY_AGES[n.tech.age];
  if (!age) return;
  n.tech.progress +=
    0.07 + Math.min(0.36, Math.sqrt(territory) * 0.007) + n.efficiency / 4000;
  const scholarChance = 0.006 + Math.min(0.014, Math.sqrt(territory) * 0.0003);
  const scholarBreakthrough = random(s) < scholarChance;
  if (scholarBreakthrough) n.tech.progress += 6 + random(s) * 4;
  if (n.tech.progress < TECH_PROGRESS_REQUIRED) return;
  const technology = age.technologies.find(
    (t) => !n.tech.unlocked.includes(t.id),
  );
  if (!technology) {
    if (n.tech.age < TECHNOLOGY_AGES.length - 1) {
      n.tech.progress = 0;
      n.tech.age++;
      log(
        s,
        `${scholarBreakthrough ? `A gifted scholar in ${n.name} sparks a leap in learning. ` : ""}${n.name} enters the ${technologyName(n)} age, opening a new path of scholarship and military reform.`,
        "technology",
      );
    } else n.tech.progress = 0;
    return;
  }
  n.tech.progress -= TECH_PROGRESS_REQUIRED;
  n.tech.unlocked.push(technology.id);
  if (
    age.technologies.every((t) => n.tech.unlocked.includes(t.id)) &&
    n.tech.age < TECHNOLOGY_AGES.length - 1
  ) {
    n.tech.age++;
    log(
      s,
      `${scholarBreakthrough ? `A gifted scholar in ${n.name} helps unlock a new idea. ` : ""}${n.name} masters ${technology.name}; a wave of invention ushers in the ${technologyName(n)} age. ${technology.effect}`,
      "technology",
    );
  } else {
    log(
      s,
      `${scholarBreakthrough ? `A gifted scholar in ${n.name} helps unlock a new idea. ` : ""}${n.name} develops ${technology.name}. ${technology.effect}`,
      "technology",
    );
  }
}
export function stats(s) {
  const counts = Array(s.nations.length).fill(0);
  for (const n of s.owner) if (n >= 0) counts[n]++;
  return counts;
}
const distance = (i, j) =>
  ((i % W) - (j % W)) ** 2 + (Math.floor(i / W) - Math.floor(j / W)) ** 2;

export function createWorld(
  seed = "CONFLICT-2048",
  count = 16,
  preset = "continents",
  start = "borders",
) {
  let hash = 2166136261;
  for (const c of seed) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const s = {
    version: 2,
    seed,
    rng: hash,
    year: 1,
    preset,
    owner: Array(W * H).fill(WATER),
    terrain: [],
    nations: [],
    wars: [],
    truces: [],
    warStats: {},
    relations: {},
    warHistory: [],
    alliances: [],
    events: [],
    flashes: [],
    settings: { ...defaults },
  };
  const phase = Array.from({ length: 8 }, () => random(s) * Math.PI * 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = x / W,
        ny = y / H,
        edge = Math.min(nx, 1 - nx, ny, 1 - ny);
      const noise =
        Math.sin(nx * 17 + ny * 12 + phase[2]) * 0.1 +
        Math.cos(nx * 31 - ny * 26 + phase[3]) * 0.055 +
        Math.sin(nx * 67 + ny * 48 + phase[4]) * 0.025;
      let height =
        Math.sin(nx * 9 + phase[0]) * 0.22 +
        Math.cos(ny * 11 + phase[1]) * 0.2 +
        noise +
        Math.min(edge * 3, 0.43) -
        0.2;
      if (preset === "pangaea")
        height = 0.52 - Math.hypot((nx - 0.5) * 1.35, (ny - 0.5) * 1.4) + noise;
      if (preset === "islands")
        height =
          Math.sin(nx * 24 + phase[0]) * 0.15 +
          Math.cos(ny * 26 + phase[1]) * 0.15 +
          noise +
          Math.min(edge * 3, 0.15) -
          0.22;
      if (preset === "arena")
        height = edge > 0.035 ? 0.12 + noise * 0.25 : -0.2;
      if (preset === "blank") height = -0.2;
      s.terrain.push(height);
      s.owner[y * W + x] = height > 0 ? NEUTRAL : WATER;
    }
  if (REAL_MAPS[preset]) {
    s.owner.fill(WATER);
    s.terrain.fill(-0.2);
    REAL_MAPS[preset].rows.forEach((spans, y) => {
      for (let k = 0; k < spans.length; k += 2) {
        for (let x = spans[k]; x < spans[k] + spans[k + 1]; x++) {
          s.owner[y * W + x] = NEUTRAL;
          s.terrain[y * W + x] = 0.12;
        }
      }
    });
  }
  const land = s.owner
      .map((n, i) => (n === NEUTRAL ? i : -1))
      .filter((i) => i >= 0),
    seeds = [];
  for (let n = 0; n < Math.min(count, MAX_NATIONS) && land.length; n++) {
    let best = land[0],
      score = -1;
    for (let k = 0; k < 200; k++) {
      const i = pick(s, land);
      const d = seeds.length
        ? Math.min(...seeds.map((j) => distance(i, j)))
        : random(s);
      if (d > score) {
        best = i;
        score = d;
      }
    }
    if (seeds.includes(best)) break;
    seeds.push(best);
    spawnNation(s, best, { quiet: true, radius: 2 });
  }
  if (start === "borders" && seeds.length) {
    // Multi-source flood fill keeps initial borders contiguous, rather than drawing Voronoi lines through the sea.
    const queue = [...seeds];
    let head = 0;
    s.owner = s.owner.map((n) => (n === WATER ? WATER : NEUTRAL));
    seeds.forEach((i, n) => (s.owner[i] = n));
    while (head < queue.length) {
      const i = queue[head++];
      for (const j of neighbors(i)) {
        if (s.owner[j] === NEUTRAL) {
          s.owner[j] = s.owner[i];
          queue.push(j);
        }
      }
    }
  }
  if (start === "borders") claimUnownedLand(s);
  s.climate = { year: s.year, seasons: seasonalOutlook(s) };
  reconcile(s);
  s.nations.forEach((n) => {
    n.population = stats(s)[n.id] * 300;
    n.peak = stats(s)[n.id];
  });
  log(
    s,
    preset === "blank"
      ? "An empty canvas. Paint land, then place your first nation."
      : `${s.nations.length} nations enter a new age. The world is theirs to conquer.`,
  );
  return s;
}
function nationRecord(s, id, capital, name) {
  const identityRoll = (salt) => {
    let hash = Math.imul(
      (s.rng ^ capital ^ Math.imul(id + 1, 0x9e3779b1) ^ salt) >>> 0,
      2246822519,
    );
    hash ^= hash >>> 13;
    return (hash >>> 0) / 4294967296;
  };
  return {
    id,
    name: name || generateNationName(s, capital),
    color: colors[id % colors.length],
    capital,
    wealth: 160,
    stability: 85,
    population: 1000,
    aggression: 0.45 + random(s) * 0.5,
    efficiency: 75,
    peak: 0,
    kills: 0,
    born: s.year,
    dead: null,
    government:
      GOVERNMENTS[Math.floor(identityRoll(0x51ed) * GOVERNMENTS.length)].id,
    religion: (() => {
      const nearest = s.nations
        .map((nation) => ({
          nation,
          distance: distance(capital, nation.capital),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      return nearest && nearest.distance < 30 && identityRoll(0x72a9) < 0.72
        ? nearest.nation.religion
        : RELIGIONS[Math.floor(identityRoll(0xc0de) * RELIGIONS.length)];
    })(),
    tech: { age: 0, progress: 0, unlocked: [] },
  };
}
export function spawnNation(s, cell, { quiet = false, radius = 3, name } = {}) {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= W * H ||
    s.owner[cell] === WATER ||
    s.nations.length >= MAX_NATIONS
  )
    return -1;
  const id = s.nations.length;
  s.nations.push(nationRecord(s, id, cell, name));
  // A connected patch of land, including an existing nation's territory when placed by the user.
  const queue = [cell],
    seen = new Set(queue);
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    s.owner[i] = id;
    for (const j of neighbors(i))
      if (
        !seen.has(j) &&
        s.owner[j] !== WATER &&
        distance(j, cell) <= radius * radius
      ) {
        seen.add(j);
        queue.push(j);
      }
  }
  reconcile(s);
  if (!quiet) log(s, `${s.nations[id].name} is founded.`, "birth");
  return id;
}
// Claim all remaining land, including islands disconnected from any capital.
export function claimUnownedLand(s) {
  const owned = s.owner.flatMap((id, cell) => (id >= 0 ? [cell] : []));
  if (!owned.length) return;
  const queue = [...owned];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    for (const next of neighbors(cell))
      if (s.owner[next] === NEUTRAL) {
        s.owner[next] = s.owner[cell];
        queue.push(next);
      }
  }
  owned.splice(0, owned.length, ...queue);
  // Assign each isolated landmass to the nearest established coast, then flood it.
  for (let cell = 0; cell < s.owner.length; cell++) {
    if (s.owner[cell] !== NEUTRAL) continue;
    let closest = owned[0],
      best = Infinity;
    for (const coast of owned) {
      const d = distance(cell, coast);
      if (d < best) {
        best = d;
        closest = coast;
      }
    }
    s.owner[cell] = s.owner[closest];
    const island = [cell];
    for (let head = 0; head < island.length; head++) {
      for (const next of neighbors(island[head]))
        if (s.owner[next] === NEUTRAL) {
          s.owner[next] = s.owner[cell];
          island.push(next);
        }
    }
  }
  reconcile(s);
  const sizes = stats(s);
  s.nations.forEach((n) => {
    n.population = sizes[n.id] * 300;
    n.peak = Math.max(n.peak, sizes[n.id]);
  });
}

export function reconcile(s) {
  const counts = stats(s);
  s.nations.forEach((n, id) => {
    if (!counts[id]) {
      if (n.dead === null) {
        n.dead = s.year;
        log(s, `${n.name} has fallen.`, "fall");
      }
      n.population = 0;
      return;
    }
    n.dead = null;
    n.peak = Math.max(n.peak || 0, counts[id]);
    if (s.owner[n.capital] !== id) n.capital = s.owner.indexOf(id);
    n.population = Math.max(100, n.population);
  });
  for (const record of s.warHistory || [])
    if (record.ended === null && (!counts[record.a] || !counts[record.b])) {
      record.ended = s.year;
      record.outcome =
        "The war ends with the loss of a belligerent's independent territory.";
    }
  for (const key of ["wars", "alliances"])
    s[key] = s[key].filter((p) => counts[p[0]] && counts[p[1]]);
  s.truces = (s.truces || []).filter(
    (p) => counts[p[0]] && counts[p[1]] && p[2] > s.year,
  );
  s.warStats ||= {};
  const active = new Set(s.wars.map((p) => p.slice(0, 2).join(",")));
  for (const key of Object.keys(s.warStats))
    if (!active.has(key)) delete s.warStats[key];
  return counts;
}
export const hasTruce = (s, a, b) =>
  (s.truces || []).some((p) => related([p], a, b) && p[2] > s.year);
export function declareWar(s, a, b, { force = true, reason = null } = {}) {
  const counts = stats(s);
  if (a === b || !counts[a] || !counts[b] || related(s.wars, a, b))
    return false;
  const pactPath = alliancePath(s, a, b);
  if (!force && (hasTruce(s, a, b) || pactPath.length || !reason)) return false;
  if (hasTruce(s, a, b))
    log(
      s,
      `${s.nations[a].name} breaks its truce with ${s.nations[b].name}.`,
      "war",
    );
  s.truces = (s.truces || []).filter((p) => !related([p], a, b));
  if (pactPath.length) {
    const broken = new Set(pactPath.map((p) => p.join(",")));
    s.alliances = s.alliances.filter((p) => !broken.has(p.join(",")));
    log(
      s,
      `${s.nations[a].name} breaks the alliance ties linking it to ${s.nations[b].name}.`,
      "peace",
    );
  }
  s.wars.push([...pair(a, b), s.year]);
  s.warStats ||= {};
  s.warStats[pair(a, b).join(",")] = [0, 0];
  const [first, second] = pair(a, b);
  const cause =
    reason ||
    "a direct intervention by the player orders this war, overriding ordinary diplomacy";
  s.warHistory ||= [];
  if (s.warHistory.length >= 2048)
    s.warHistory.splice(
      Math.max(
        0,
        s.warHistory.findIndex((r) => r.ended !== null),
      ),
      1,
    );
  s.warHistory.push({
    a: first,
    b: second,
    initiator: a,
    started: s.year,
    ended: null,
    reason: cause,
    initial: [counts[first], counts[second]],
    outcome: "",
  });
  log(
    s,
    `${s.nations[a].name} declares war on ${s.nations[b].name}. The stated cause is that ${cause}.`,
    "war",
  );
  return true;
}
export function peace(
  s,
  a,
  b = null,
  { reason = "Negotiators agree to end the war" } = {},
) {
  const ended = s.wars.filter(
    (p) =>
      (p[0] === a || p[1] === a) && (b === null || p[0] === b || p[1] === b),
  );
  s.wars = s.wars.filter((p) => !ended.includes(p));
  s.truces ||= [];
  for (const [first, second] of ended) {
    s.truces = s.truces.filter((p) => !related([p], first, second));
    s.truces.push([first, second, s.year + 15]);
    const gains = s.warStats?.[`${first},${second}`] || [0, 0];
    const net = gains[0] - gains[1];
    const outcome = net
      ? `${s.nations[net > 0 ? first : second].name} retains a net gain of ${Math.abs(net)} tiles from the fighting`
      : "neither side retains a net territorial gain from the fighting";
    const record = (s.warHistory || []).findLast(
      (r) => r.ended === null && r.a === first && r.b === second,
    );
    if (record) {
      record.ended = s.year;
      record.outcome = outcome;
    }
    settleRelation(s, first, second);
    log(
      s,
      `The settlement of year ${s.year}. ${reason}. ${outcome}. Both governments recognize the new frontier and renounce their claims; a 15-year truce begins.`,
      "peace",
    );
    if (s.warStats) delete s.warStats[`${first},${second}`];
  }
  return ended.length;
}
export function ally(s, a, b) {
  const counts = stats(s);
  if (a === b || !counts[a] || !counts[b]) return false;
  if (related(s.alliances, a, b)) {
    s.alliances = s.alliances.filter((p) => !related([p], a, b));
    const r = relation(s, a, b);
    r.tension = Math.max(r.tension, 24);
    r.since = s.year;
    r.stage = 0;
    r.initiator = b;
    r.reason = `${s.nations[b].name} seeks security guarantees after ${s.nations[a].name} ended their alliance`;
    log(
      s,
      `${s.nations[a].name} ends its alliance with ${s.nations[b].name}.`,
      "peace",
    );
    return false;
  }
  peace(s, a, b);
  settleRelation(s, a, b);
  s.alliances.push(pair(a, b));
  log(
    s,
    `${s.nations[a].name} and ${s.nations[b].name} form an alliance.`,
    "peace",
  );
  return true;
}
export function annex(s, a, b) {
  const counts = stats(s);
  if (a === b || !counts[a] || !counts[b]) return false;
  s.owner = s.owner.map((n) => (n === b ? a : n));
  s.nations[a].wealth = Math.min(
    99999,
    s.nations[a].wealth + s.nations[b].wealth,
  );
  s.nations[a].kills++;
  s.nations[a].population += s.nations[b].population;
  log(s, `${s.nations[a].name} annexes ${s.nations[b].name}.`, "fall");
  reconcile(s);
  return true;
}
export function collapse(s, a) {
  if (!stats(s)[a]) return false;
  s.owner = s.owner.map((n) => (n === a ? NEUTRAL : n));
  log(s, `${s.nations[a].name} collapses. Its lands are unclaimed.`, "fall");
  reconcile(s);
  return true;
}
export function rebel(s, a) {
  const cells = s.owner.map((n, i) => (n === a ? i : -1)).filter((i) => i >= 0);
  if (cells.length < 30 || s.nations.length >= MAX_NATIONS) return false;
  // Start away from the capital, then take a connected region without wrapping map edges.
  const candidates = cells.filter(
    (i) => distance(i, s.nations[a].capital) > 16,
  );
  if (!candidates.length) return false;
  const center = pick(s, candidates),
    id = s.nations.length,
    old = s.nations[a];
  s.nations.push(
    nationRecord(
      s,
      id,
      center,
      generateNationName(s, center, { revolution: true }),
    ),
  );
  const queue = [center],
    seen = new Set(queue);
  let head = 0,
    taken = 0;
  while (head < queue.length && taken < Math.floor(cells.length * 0.25)) {
    const i = queue[head++];
    if (i === old.capital) continue;
    s.owner[i] = id;
    taken++;
    for (const j of neighbors(i))
      if (!seen.has(j) && s.owner[j] === a) {
        seen.add(j);
        queue.push(j);
      }
  }
  old.stability = 75;
  s.nations[id].population = Math.max(
    100,
    Math.floor((old.population * taken) / cells.length),
  );
  old.population -= s.nations[id].population;
  log(
    s,
    `${s.nations[id].name} rebels against ${old.name}. A new banner rises over the breakaway capital. The uprising has become a country, and its former rulers must decide its fate on the battlefield.`,
    "birth",
  );
  reconcile(s);
  declareWar(s, id, a, {
    reason: `${s.nations[id].name} seeks independence from ${old.name}, whose government refuses to recognize the breakaway state`,
  });
  return true;
}
export function paint(s, cell, radius, mode, nation = null) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= W * H) return false;
  if (mode === "territory" && (!Number.isInteger(nation) || !s.nations[nation]))
    return false;
  const x = cell % W,
    y = Math.floor(cell / W);
  let changed = false;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const i = ny * W + nx;
      if (mode === "land" && s.owner[i] === WATER) {
        s.owner[i] = NEUTRAL;
        s.terrain[i] = 0.12;
        changed = true;
      }
      if (mode === "water") {
        s.owner[i] = WATER;
        s.terrain[i] = -0.2;
        changed = true;
      }
      if (mode === "erase" && s.owner[i] !== WATER) {
        s.owner[i] = NEUTRAL;
        changed = true;
      }
      if (mode === "territory" && s.owner[i] !== WATER) {
        s.owner[i] = nation;
        changed = true;
      }
    }
  reconcile(s);
  return changed;
}
export const MAX_SEA_CROSSING = 4;
// Find the closest shore through water only. Land blocks the route, and the
// search never wraps map edges or treats a straight line over land as a voyage.
export function nearbySeaLandings(s, nation, target = NEUTRAL, origins = null) {
  const coast =
    origins ||
    s.owner.map((id, i) => (id === nation ? i : -1)).filter((i) => i >= 0);
  const seen = new Set(),
    queue = [],
    results = new Set();
  for (const origin of coast) {
    if (s.owner[origin] !== nation) continue;
    for (const cell of neighbors(origin)) {
      if (s.owner[cell] === WATER && !seen.has(cell)) {
        seen.add(cell);
        queue.push([cell, 1]);
      }
    }
  }
  let closest = MAX_SEA_CROSSING + 1;
  for (let head = 0; head < queue.length; head++) {
    const [cell, waterTiles] = queue[head];
    if (waterTiles > closest) break;
    for (const next of neighbors(cell)) {
      const owner = s.owner[next];
      if (owner === WATER) {
        if (
          waterTiles < MAX_SEA_CROSSING &&
          waterTiles < closest &&
          !seen.has(next)
        ) {
          seen.add(next);
          queue.push([next, waterTiles + 1]);
        }
      } else if (
        target === null ? owner >= 0 && owner !== nation : owner === target
      ) {
        closest = waterTiles;
        results.add(next);
      }
    }
  }
  return [...results];
}
function frontiers(s) {
  const expansion = [],
    borders = new Map(),
    coasts = Array.from({ length: s.nations.length }, () => []);
  for (let i = 0; i < s.owner.length; i++) {
    const a = s.owner[i];
    if (a === WATER) continue;
    let coast = false;
    for (const j of neighbors(i)) {
      const b = s.owner[j];
      if (b === WATER) coast = true;
      if (a >= 0 && b === NEUTRAL) expansion.push([i, j]);
      if (a >= 0 && b >= 0 && a !== b && i < j) {
        const key = pair(a, b).join(",");
        if (!borders.has(key)) borders.set(key, []);
        borders.get(key).push([i, j]);
      }
    }
    if (coast) {
      if (a >= 0) coasts[a].push(i);
    }
  }
  return { expansion, borders, coasts };
}
function capture(
  s,
  cell,
  winner,
  loser,
  budget,
  attacker = winner,
  battleLosses,
  battleMarked,
  territoryBaseline,
  campaignWeather,
) {
  const queue = [cell],
    seen = new Set(queue);
  let head = 0,
    taken = 0,
    capturedCapital = false;
  while (head < queue.length && taken < budget) {
    const i = queue[head++];
    if (s.owner[i] !== loser) continue;
    s.owner[i] = winner;
    taken++;
    if (i === s.nations[loser].capital) {
      capturedCapital = true;
      s.nations[loser].stability = Math.max(5, s.nations[loser].stability - 15);
      s.nations[winner].wealth = Math.min(99999, s.nations[winner].wealth + 50);
      log(
        s,
        `${s.nations[winner].name} captures the capital of ${s.nations[loser].name}. The defending government loses its seat of power. The victors seize 50 gold while their rival suffers a blow to stability.`,
        "battle",
      );
    }
    for (const j of neighbors(i))
      if (!seen.has(j) && s.owner[j] === loser) {
        seen.add(j);
        queue.push(j);
      }
  }
  if (taken) {
    const terrain = s.terrain[cell];
    const campaignLoss = (battleLosses[loser] || 0) + taken;
    battleLosses[loser] = campaignLoss;
    const massiveLoss =
      campaignLoss >= Math.max(20, Math.ceil(territoryBaseline[loser] * 0.25));
    const annihilated = stats(s)[loser] === 0;
    const keyBattle = !battleMarked[loser] && (massiveLoss || annihilated);
    if (keyBattle) battleMarked[loser] = true;
    s.flashes.push({
      cell,
      color: s.nations[winner].color,
      year: s.year,
      winner,
      loser,
      attacker,
      tiles: taken,
      campaignLoss,
      defenderTerritory: territoryBaseline[loser],
      terrain,
      capital: capturedCapital,
      annihilated,
      key: keyBattle,
      season: campaignWeather?.season,
      weather: campaignWeather?.weather,
    });
  }
  if (taken) recordLoss(s, winner, loser, taken);
  const key = pair(winner, loser).join(",");
  s.warStats ||= {};
  s.warStats[key] ||= [0, 0];
  s.warStats[key][winner < loser ? 0 : 1] += taken;
  return taken;
}
export function tick(s) {
  s.year++;
  s.climate = { year: s.year, seasons: seasonalOutlook(s) };
  s.flashes = [];
  const before = stats(s);
  if (!s.settings.ai) return;
  const battleLosses = Array(s.nations.length).fill(0),
    battleMarked = Array(s.nations.length).fill(false);
  const { expansion, borders, coasts } = frontiers(s);
  if (s.settings.expansion) {
    // Shuffle frontier attempts so nations act together, without giving low IDs first choice.
    for (let k = expansion.length - 1; k > 0; k--) {
      const j = Math.floor(random(s) * (k + 1));
      [expansion[k], expansion[j]] = [expansion[j], expansion[k]];
    }
    for (const [i, j] of expansion) {
      if (s.owner[i] >= 0 && s.owner[j] === NEUTRAL && random(s) < 0.58)
        s.owner[j] = s.owner[i];
    }
    if (s.year % 6 === 0)
      for (const n of s.nations)
        if (before[n.id] && coasts[n.id].length && random(s) < 0.22) {
          const landings = nearbySeaLandings(s, n.id, NEUTRAL, coasts[n.id]);
          if (landings.length) s.owner[pick(s, landings)] = n.id;
        }
  }
  diplomacyTick(s, borders, coasts, before);
  const fronts = Array(s.nations.length).fill(0);
  for (const [a, b] of s.wars) {
    fronts[a]++;
    fronts[b]++;
  }
  const power = (id) => {
    const n = s.nations[id];
    const allySupport = allianceMembers(s, id).length;
    return (
      ((20 + Math.sqrt(before[id]) * 2) *
        (n.efficiency / 100) *
        (1 +
          technologyBonus(n, "offense") +
          technologyBonus(n, "siege") +
          governmentBonus(n, "offense")) *
        (0.35 + Math.min(n.wealth, 500) / 500) *
        (0.5 + n.stability / 100) *
        (1 + allySupport * 0.12)) /
      Math.sqrt(Math.max(1, fronts[id]))
    );
  };
  for (const [a, b, started] of [...s.wars]) {
    if (!before[a] || !before[b]) continue;
    const edges = borders.get(pair(a, b).join(",")) || [];
    const pa = power(a),
      pb = power(b);
    if (edges.length) {
      const rounds = Math.min(7, 1 + Math.ceil(edges.length / 35));
      for (let r = 0; r < rounds; r++) {
        const edge = pick(s, edges);
        // Earlier battles may have changed this edge; never attack through a third nation.
        const owners = edge.map((i) => s.owner[i]);
        if (!owners.includes(a) || !owners.includes(b)) continue;
        const attacker = random(s) < pa / (pa + pb) ? a : b,
          defender = attacker === a ? b : a;
        const target = edge.find((i) => s.owner[i] === defender);
        if (target === undefined) continue;
        const seasonIndex = (r + s.year) % SEASONS.length;
        const weather = climateRoll(s, target, seasonIndex);
        const campaignWeather = { season: SEASONS[seasonIndex], weather };
        const height = Math.max(0, s.terrain[target]);
        const resistance = Math.max(
          0.35,
          1 -
            Math.max(0, height - 0.18) *
              (1.35 - technologyBonus(s.nations[attacker], "siege")),
        );
        const weatherAttack =
          weather === "storm" || weather === "snow"
            ? 0.78
            : weather === "rain"
              ? 0.88
              : weather === "fog"
                ? 0.93
                : 1;
        const weatherDefense =
          weather === "snow" || weather === "storm"
            ? 1.12
            : weather === "fog"
              ? 1.06
              : 1;
        const attackPower = power(attacker) * weatherAttack;
        const defensivePower =
          power(defender) *
          (1 +
            height * 0.45 +
            technologyBonus(s.nations[defender], "defense") +
            governmentBonus(s.nations[defender], "defense")) *
          weatherDefense;
        const winner =
          random(s) < attackPower / (attackPower + defensivePower)
            ? attacker
            : defender;
        const loser = winner === a ? b : a;
        capture(
          s,
          target,
          winner,
          loser,
          Math.max(
            1,
            Math.floor(
              (7 + random(s) * 20) *
                resistance *
                (weather === "storm" || weather === "snow"
                  ? 0.65
                  : weather === "rain"
                    ? 0.8
                    : 1) *
                (1 + technologyBonus(s.nations[winner], "siege")),
            ),
          ),
          attacker,
          battleLosses,
          battleMarked,
          before,
          campaignWeather,
        );
      }
    } else if (s.year % 4 === 0 && coasts[a].length && coasts[b].length) {
      const winner = random(s) < pa / (pa + pb) ? a : b,
        loser = winner === a ? b : a;
      if (s.nations[winner].wealth > 30) {
        const landings = nearbySeaLandings(s, winner, loser, coasts[winner]);
        if (landings.length) {
          capture(
            s,
            pick(s, landings),
            winner,
            loser,
            4,
            winner,
            battleLosses,
            battleMarked,
            before,
          );
          s.nations[winner].wealth -= 20;
        }
      }
    }
    considerSettlement(s, a, b, started, before);
  }
  const after = stats(s);
  for (const n of s.nations) {
    const id = n.id;
    if (!after[id]) {
      if (before[id]) {
        const victor = s.owner[n.capital];
        if (victor >= 0) s.nations[victor].kills++;
      }
      continue;
    }
    const cost = fronts[id] * 3.5;
    n.income = Number(
      (
        1 +
        Math.sqrt(after[id]) *
          (0.22 +
            technologyBonus(n, "economy") +
            governmentBonus(n, "economy")) -
        cost
      ).toFixed(1),
    );
    n.wealth = Math.max(0, Math.min(99999, n.wealth + n.income));
    n.efficiency = Math.max(
      15,
      Math.min(
        150,
        n.efficiency + (n.wealth < 10 ? -1.2 : fronts[id] ? -0.06 : 0.25),
      ),
    );
    n.stability = Math.max(
      5,
      Math.min(
        100,
        n.stability +
          (fronts[id] ? -0.25 : 0.6 + governmentBonus(n, "stability")),
      ),
    );
    n.population = after[id] * 300;
    n.peak = Math.max(n.peak, after[id]);
    research(s, n, after[id]);
    if (
      s.settings.revolts &&
      s.nations.length < MAX_NATIONS &&
      after[id] > 150 &&
      n.stability < 45 &&
      random(s) < 0.018
    )
      rebel(s, id);
  }
  reconcile(s);
}
export function validate(input) {
  // Validate into a fresh object: a rejected import never mutates a running game.
  const s = structuredClone(input),
    finite = Number.isFinite,
    integer = Number.isInteger;
  const fail = () => {
    throw Error("Invalid world save");
  };
  if (
    !s ||
    ![1, 2].includes(s.version) ||
    !integer(s.year) ||
    s.year < 1 ||
    !integer(s.rng) ||
    typeof s.seed !== "string" ||
    s.seed.length > 100 ||
    !Array.isArray(s.nations) ||
    s.nations.length > MAX_NATIONS
  )
    fail();
  if (
    !Array.isArray(s.owner) ||
    s.owner.length !== W * H ||
    !Array.isArray(s.terrain) ||
    s.terrain.length !== W * H ||
    !s.terrain.every(finite) ||
    !s.owner.every((n) => integer(n) && n >= NEUTRAL && n < s.nations.length)
  )
    fail();
  if (s.owner.some((n, i) => (n === WATER) !== s.terrain[i] <= 0)) fail();
  if (s.version === 1) {
    s.settings = { ...defaults };
    s.preset = "legacy";
    s.nations.forEach((n) =>
      Object.assign(n, {
        efficiency: 75,
        peak: 0,
        kills: 0,
        born: 1,
        dead: null,
      }),
    );
    s.version = 2;
  }
  s.nations.forEach((n, i) => {
    n.tech ??= { age: 0, progress: 0, unlocked: [] };
    n.government ??= GOVERNMENTS[i % GOVERNMENTS.length].id;
    n.religion ??= RELIGIONS[i % RELIGIONS.length];
    if (
      n.id !== i ||
      typeof n.name !== "string" ||
      n.name.length > 60 ||
      !GOVERNMENTS.some((government) => government.id === n.government) ||
      !RELIGIONS.includes(n.religion) ||
      !/^#[0-9a-f]{6}$/i.test(n.color) ||
      !integer(n.capital) ||
      n.capital < 0 ||
      n.capital >= W * H ||
      ![
        "wealth",
        "stability",
        "population",
        "aggression",
        "efficiency",
        "peak",
        "kills",
        "born",
      ].every((k) => finite(n[k]) && n[k] >= 0) ||
      !n.tech ||
      !integer(n.tech.age) ||
      n.tech.age < 0 ||
      n.tech.age >= TECHNOLOGY_AGES.length ||
      !finite(n.tech.progress) ||
      n.tech.progress < 0 ||
      n.tech.progress > TECH_PROGRESS_REQUIRED ||
      !Array.isArray(n.tech.unlocked) ||
      n.tech.unlocked.length >
        TECHNOLOGY_AGES.reduce(
          (sum, age) => sum + age.technologies.length,
          0,
        ) ||
      !n.tech.unlocked.every((id) =>
        TECHNOLOGY_AGES.some((age) =>
          age.technologies.some((t) => t.id === id),
        ),
      ) ||
      new Set(n.tech.unlocked).size !== n.tech.unlocked.length ||
      !(n.dead === null || (integer(n.dead) && n.dead >= 1))
    )
      fail();
  });
  for (const key of ["wars", "alliances"]) {
    if (
      !Array.isArray(s[key]) ||
      s[key].length > MAX_NATIONS ** 2 ||
      !s[key].every(
        (p) =>
          Array.isArray(p) &&
          p.length === (key === "wars" ? 3 : 2) &&
          p.every(integer) &&
          p[0] >= 0 &&
          p[1] < s.nations.length &&
          p[0] < p[1] &&
          (key !== "wars" || p[2] >= 1),
      )
    )
      fail();
    if (
      new Set(s[key].map((p) => p.slice(0, 2).join(","))).size !== s[key].length
    )
      fail();
  }
  if (s.wars.some((p) => allied(s, p[0], p[1]))) fail();
  s.truces ??= [];
  if (
    !Array.isArray(s.truces) ||
    s.truces.length > MAX_NATIONS ** 2 ||
    !s.truces.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 3 &&
        p.every(integer) &&
        p[0] >= 0 &&
        p[1] < s.nations.length &&
        p[0] < p[1] &&
        p[2] >= 1,
    )
  )
    fail();
  if (s.wars.some((p) => hasTruce(s, p[0], p[1]))) fail();
  s.warStats ??= {};
  if (
    !s.warStats ||
    typeof s.warStats !== "object" ||
    Array.isArray(s.warStats) ||
    Object.keys(s.warStats).length > MAX_NATIONS ** 2 ||
    !Object.values(s.warStats).every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => integer(n) && n >= 0),
    )
  )
    fail();
  for (const [a, b] of s.wars) s.warStats[`${a},${b}`] ??= [0, 0];
  s.relations ??= {};
  s.warHistory ??= [];
  if (
    !s.relations ||
    typeof s.relations !== "object" ||
    Array.isArray(s.relations) ||
    Object.keys(s.relations).length > MAX_NATIONS ** 2
  )
    fail();
  for (const [key, r] of Object.entries(s.relations)) {
    if (
      !r ||
      !integer(r.a) ||
      !integer(r.b) ||
      r.a < 0 ||
      r.b >= s.nations.length ||
      r.a >= r.b ||
      key !== `${r.a},${r.b}` ||
      ![r.a, r.b].includes(r.initiator) ||
      !finite(r.tension) ||
      r.tension < 0 ||
      r.tension > 100 ||
      !integer(r.stage) ||
      r.stage < 0 ||
      r.stage > 3 ||
      !integer(r.since) ||
      r.since < 1 ||
      r.since > s.year ||
      typeof r.reason !== "string" ||
      r.reason.length > 800 ||
      ![r.claims, r.baseline].every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((n) => integer(n) && n >= 0),
      ) ||
      (r.strength !== undefined &&
        (!Array.isArray(r.strength) ||
          r.strength.length !== 2 ||
          !r.strength.every((n) => finite(n) && n > 0)))
    )
      fail();
  }
  if (
    !Array.isArray(s.warHistory) ||
    s.warHistory.length > 2048 ||
    !s.warHistory.every(
      (r) =>
        r &&
        integer(r.a) &&
        integer(r.b) &&
        r.a >= 0 &&
        r.b < s.nations.length &&
        r.a < r.b &&
        [r.a, r.b].includes(r.initiator) &&
        integer(r.started) &&
        r.started >= 1 &&
        r.started <= s.year &&
        (r.ended === null ||
          (integer(r.ended) && r.ended >= r.started && r.ended <= s.year)) &&
        typeof r.reason === "string" &&
        r.reason.length <= 1000 &&
        typeof r.outcome === "string" &&
        r.outcome.length <= 1000 &&
        Array.isArray(r.initial) &&
        r.initial.length === 2 &&
        r.initial.every((n) => integer(n) && n >= 0),
    )
  )
    fail();
  if (
    !s.settings ||
    !["ai", "wars", "alliances", "revolts", "expansion"].every(
      (k) => typeof s.settings[k] === "boolean",
    ) ||
    !finite(s.settings.aggression) ||
    s.settings.aggression < 0 ||
    s.settings.aggression > 3
  )
    fail();
  if (
    !Array.isArray(s.events) ||
    s.events.length > 150 ||
    !s.events.every(
      (e) =>
        typeof e.text === "string" &&
        e.text.length < 1000 &&
        integer(e.year) &&
        e.year >= 1,
    )
  )
    fail();
  s.flashes = [];
  reconcile(s);
  return s;
}
