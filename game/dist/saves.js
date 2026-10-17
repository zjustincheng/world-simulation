import { validate } from "./engine.js";
export const LIBRARY_KEY = "world-simulation-library-v1";
export const RECOVERY_KEY = "world-simulation-recovery-v1";
export const MAX_SAVES = 6;
export function readSaves(storage) {
  const raw = storage.getItem(LIBRARY_KEY);
  if (raw) {
    const entries = JSON.parse(raw);
    if (
      !Array.isArray(entries) ||
      entries.length > MAX_SAVES ||
      !entries.every(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.name === "string" &&
          Number.isFinite(e.savedAt),
      )
    )
      throw Error(
        "The save library could not be read. Export your current world before clearing browser storage.",
      );
    return entries;
  }
  const legacy = storage.getItem("world-simulation-save");
  return legacy
    ? [
        {
          id: "legacy",
          name: "Previous saved world",
          savedAt: 0,
          world: validate(JSON.parse(legacy)),
        },
      ]
    : [];
}
export function saveWorld(storage, world, name, id = null) {
  const entries = readSaves(storage),
    existing = entries.findIndex((e) => e.id === id);
  if (existing < 0 && entries.length >= MAX_SAVES)
    throw Error("All six slots are full. Replace or delete an existing save.");
  const entry = {
    id: existing >= 0 ? id : crypto.randomUUID(),
    name: name.trim().slice(0, 60) || "Untitled world",
    savedAt: Date.now(),
    world: validate(world),
  };
  if (existing >= 0) entries[existing] = entry;
  else entries.unshift(entry);
  storage.setItem(LIBRARY_KEY, JSON.stringify(entries));
  return entry;
}
export function deleteSave(storage, id) {
  const entries = readSaves(storage).filter((e) => e.id !== id);
  storage.setItem(LIBRARY_KEY, JSON.stringify(entries));
}
export function writeRecovery(storage, world) {
  storage.setItem(
    RECOVERY_KEY,
    JSON.stringify({ savedAt: Date.now(), world: validate(world) }),
  );
}
export function readRecovery(storage) {
  const raw = storage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  const entry = JSON.parse(raw);
  return { savedAt: entry.savedAt, world: validate(entry.world) };
}
