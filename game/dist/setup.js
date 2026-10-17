import {
  W,
  NEUTRAL,
  MAX_NATIONS,
  random,
  spawnNation,
  stats,
  claimUnownedLand,
} from "./engine.js";

// Spread capitals across unclaimed land without stealing existing territory.
export function populateWorld(s, count = 12) {
  if (!Number.isInteger(count) || count < 1 || count > 32)
    throw Error("Choose 1–32 nations.");
  const capitals = s.nations
    .filter((n) => stats(s)[n.id])
    .map((n) => n.capital);
  let added = 0;
  while (added < count && s.nations.length < MAX_NATIONS) {
    const candidates = s.owner.flatMap((owner, i) =>
      owner === NEUTRAL ? [i] : [],
    );
    if (!candidates.length) break;
    let best = candidates[0],
      bestDistance = -1;
    for (let attempt = 0; attempt < 100; attempt++) {
      const cell = candidates[Math.floor(random(s) * candidates.length)];
      const distance = capitals.length
        ? Math.min(
            ...capitals.map(
              (c) =>
                ((c % W) - (cell % W)) ** 2 +
                (Math.floor(c / W) - Math.floor(cell / W)) ** 2,
            ),
          )
        : 1;
      if (distance > bestDistance) {
        best = cell;
        bestDistance = distance;
      }
    }
    // A single unclaimed capital cannot overwrite an existing country's land.
    if (spawnNation(s, best, { radius: 0 }) < 0) break;
    capitals.push(best);
    added++;
  }
  if (added) claimUnownedLand(s);
  return added;
}
