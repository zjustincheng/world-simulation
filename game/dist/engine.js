// Deterministic tile simulation. -1 = water, -2 = unclaimed land.
import { REAL_MAPS } from "./real-maps.js";
export const W = 160,
  H = 100,
  WATER = -1,
  NEUTRAL = -2,
  MAX_NATIONS = 64;
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
const names = [
  "Aurelia",
  "Veyr",
  "Northreach",
  "Solmere",
  "Veloria",
  "Rosewater",
  "Elderwood",
  "Thalen",
  "Karth",
  "Frosthold",
  "Sundale",
  "Ashen",
  "Caldera",
  "Myr",
  "Ostara",
  "Dunwich",
  "Illyria",
  "Ravenport",
  "Senora",
  "Valen",
  "Caspia",
  "Redhaven",
  "Arcadia",
  "Borealis",
  "Nerath",
  "Estara",
  "Haldor",
  "Lysander",
  "Marava",
  "Orinth",
  "Talmar",
  "Westfall",
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
export function log(s, text, type = "world") {
  s.events.unshift({ year: s.year, text, type });
  s.events.length = Math.min(s.events.length, 150);
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
  return {
    id,
    name:
      name ||
      names[id % names.length] +
        (id >= names.length ? " " + (Math.floor(id / names.length) + 1) : ""),
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
export function declareWar(s, a, b, { force = true } = {}) {
  const counts = stats(s);
  if (a === b || !counts[a] || !counts[b] || related(s.wars, a, b))
    return false;
  if (!force && hasTruce(s, a, b)) return false;
  if (hasTruce(s, a, b))
    log(
      s,
      `${s.nations[a].name} breaks its truce with ${s.nations[b].name}.`,
      "war",
    );
  s.truces = (s.truces || []).filter((p) => !related([p], a, b));
  s.alliances = s.alliances.filter((p) => !related([p], a, b));
  s.wars.push([...pair(a, b), s.year]);
  s.warStats ||= {};
  s.warStats[pair(a, b).join(",")] = [0, 0];
  log(s, `${s.nations[a].name} declares war on ${s.nations[b].name}.`, "war");
  return true;
}
export function peace(s, a, b = null) {
  const ended = s.wars.filter(
    (p) =>
      (p[0] === a || p[1] === a) && (b === null || p[0] === b || p[1] === b),
  );
  s.wars = s.wars.filter((p) => !ended.includes(p));
  s.truces ||= [];
  for (const [first, second] of ended) {
    s.truces = s.truces.filter((p) => !related([p], first, second));
    s.truces.push([first, second, s.year + 15]);
    if (s.warStats) delete s.warStats[`${first},${second}`];
  }
  if (ended.length)
    log(
      s,
      `${s.nations[a].name} signs ${b === null ? "a peace accord" : `peace with ${s.nations[b].name}`}. A 15-year truce begins.`,
      "peace",
    );
  return ended.length;
}
export function ally(s, a, b) {
  const counts = stats(s);
  if (a === b || !counts[a] || !counts[b]) return false;
  if (related(s.alliances, a, b)) {
    s.alliances = s.alliances.filter((p) => !related([p], a, b));
    log(
      s,
      `${s.nations[a].name} ends its alliance with ${s.nations[b].name}.`,
      "peace",
    );
    return false;
  }
  peace(s, a, b);
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
      `Free ${old.name.replace(/^Free /, "").slice(0, 24)}`,
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
  log(s, `${s.nations[id].name} rebels against ${old.name}.`, "birth");
  reconcile(s);
  declareWar(s, id, a);
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
function frontiers(s) {
  const expansion = [],
    borders = new Map(),
    coasts = Array.from({ length: s.nations.length }, () => []),
    neutralCoasts = [];
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
      else neutralCoasts.push(i);
    }
  }
  return { expansion, borders, coasts, neutralCoasts };
}
function capture(s, cell, winner, loser, budget) {
  const queue = [cell],
    seen = new Set(queue);
  let head = 0,
    taken = 0;
  while (head < queue.length && taken < budget) {
    const i = queue[head++];
    if (s.owner[i] !== loser) continue;
    s.owner[i] = winner;
    taken++;
    if (i === s.nations[loser].capital) {
      s.nations[loser].stability = Math.max(5, s.nations[loser].stability - 15);
      s.nations[winner].wealth = Math.min(99999, s.nations[winner].wealth + 50);
      log(
        s,
        `${s.nations[winner].name} captures the capital of ${s.nations[loser].name}.`,
        "battle",
      );
    }
    for (const j of neighbors(i))
      if (!seen.has(j) && s.owner[j] === loser) {
        seen.add(j);
        queue.push(j);
      }
  }
  if (taken)
    s.flashes.push({ cell, color: s.nations[winner].color, year: s.year });
  const key = pair(winner, loser).join(",");
  s.warStats ||= {};
  s.warStats[key] ||= [0, 0];
  s.warStats[key][winner < loser ? 0 : 1] += taken;
  return taken;
}
export function tick(s) {
  s.year++;
  s.flashes = [];
  const before = stats(s);
  if (!s.settings.ai) return;
  const { expansion, borders, coasts, neutralCoasts } = frontiers(s);
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
    if (s.year % 6 === 0 && neutralCoasts.length)
      for (const n of s.nations)
        if (before[n.id] && coasts[n.id].length && random(s) < 0.22) {
          const origin = pick(s, coasts[n.id]);
          const landing = neutralCoasts.reduce((best, i) =>
            distance(i, origin) < distance(best, origin) ? i : best,
          );
          if (s.owner[landing] === NEUTRAL) s.owner[landing] = n.id;
        }
  }
  for (const key of borders.keys()) {
    const [a, b] = key.split(",").map(Number);
    if (related(s.wars, a, b) || related(s.alliances, a, b)) continue;
    if (
      s.settings.wars &&
      random(s) <
        0.028 *
          s.settings.aggression *
          (s.nations[a].aggression + s.nations[b].aggression)
    )
      declareWar(s, a, b, { force: false });
    else if (s.settings.alliances && random(s) < 0.004) ally(s, a, b);
  }
  // Separated coastal nations can still come into conflict and land across a sea.
  if (s.settings.wars && s.year % 16 === 0) {
    const living = s.nations.filter((n) => before[n.id] && coasts[n.id].length);
    if (living.length > 1) {
      const a = pick(s, living),
        b = pick(s, living);
      if (
        a !== b &&
        !related(s.alliances, a.id, b.id) &&
        random(s) < 0.6 * s.settings.aggression
      )
        declareWar(s, a.id, b.id, { force: false });
    }
  }
  const fronts = Array(s.nations.length).fill(0);
  for (const [a, b] of s.wars) {
    fronts[a]++;
    fronts[b]++;
  }
  const power = (id) => {
    const n = s.nations[id];
    const allySupport = s.alliances.filter((p) => p.includes(id)).length;
    return (
      ((20 + Math.sqrt(before[id]) * 2) *
        (n.efficiency / 100) *
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
        const winner = random(s) < pa / (pa + pb) ? a : b,
          loser = winner === a ? b : a;
        const target = edge.find((i) => s.owner[i] === loser);
        if (target === undefined) continue;
        const resistance = s.terrain[target] > 0.25 ? 0.55 : 1;
        capture(
          s,
          target,
          winner,
          loser,
          Math.max(1, Math.floor((3 + random(s) * 10) * resistance)),
        );
      }
    } else if (s.year % 4 === 0 && coasts[a].length && coasts[b].length) {
      const winner = random(s) < pa / (pa + pb) ? a : b,
        loser = winner === a ? b : a;
      if (s.nations[winner].wealth > 30) {
        capture(s, pick(s, coasts[loser]), winner, loser, 4);
        s.nations[winner].wealth -= 20;
      }
    }
    if (s.year - started > 25 && random(s) < 0.012) peace(s, a, b);
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
    n.income = Number((1 + Math.sqrt(after[id]) * 0.22 - cost).toFixed(1));
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
      Math.min(100, n.stability + (fronts[id] ? -0.25 : 0.6)),
    );
    n.population = after[id] * 300;
    n.peak = Math.max(n.peak, after[id]);
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
    if (
      n.id !== i ||
      typeof n.name !== "string" ||
      n.name.length > 60 ||
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
  if (s.wars.some((p) => related(s.alliances, p[0], p[1]))) fail();
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
