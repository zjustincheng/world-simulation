import { REAL_MAPS } from "./real-maps.js";
const W = 160,
  H = 100;
// Broad geographic inspirations, not modern political boundaries.
// Anchors are [longitude, latitude, regional noun, regional adjective].
const REGIONS = [
  [-150, 64, "Alaska", "Alaskan"],
  [-125, 50, "Cascadia", "Cascadian"],
  [-120, 37, "California", "Californian"],
  [-110, 29, "Sonora", "Sonoran"],
  [-112, 41, "Great Basin", "Basin"],
  [-105, 51, "Prairie", "Prairie"],
  [-96, 37, "Heartland", "Heartland"],
  [-90, 30, "Mississippi", "Mississippian"],
  [-76, 39, "Appalachia", "Appalachian"],
  [-72, 45, "Laurentia", "Laurentian"],
  [-85, 55, "Hudson", "Hudsonian"],
  [-100, 69, "Borealia", "Boreal"],
  [-42, 72, "Greenland", "Greenlandic"],
  [-99, 20, "Anahuac", "Anahuac"],
  [-89, 19, "Yucatan", "Yucatecan"],
  [-85, 12, "Isthmia", "Isthmian"],
  [-75, 20, "Antilles", "Antillean"],
  [-72, 5, "Orinoco", "Orinoco"],
  [-65, -6, "Amazonia", "Amazonian"],
  [-75, -13, "Andes", "Andean"],
  [-49, -13, "Cerrado", "Cerrado"],
  [-66, -39, "Patagonia", "Patagonian"],
  [-59, -28, "La Plata", "Platine"],
  [-70, -28, "Atacama", "Atacaman"],
  [-19, 65, "Iceland", "Icelandic"],
  [-8, 53, "Hibernia", "Hibernian"],
  [-1, 51, "Albion", "Albionic"],
  [-4, 57, "Caledonia", "Caledonian"],
  [-5, 40, "Iberia", "Iberian"],
  [2, 47, "Gaul", "Gallic"],
  [12, 43, "Italia", "Italic"],
  [10, 48, "Alpine March", "Alpine"],
  [8, 53, "Rhineland", "Rhenish"],
  [21, 52, "Vistula", "Vistulan"],
  [25, 44, "Danubia", "Danubian"],
  [23, 38, "Aegea", "Aegean"],
  [15, 63, "Scandia", "Scandian"],
  [27, 63, "Karelia", "Karelian"],
  [27, 57, "Baltica", "Baltic"],
  [34, 49, "Dnieper", "Dnieper"],
  [40, 57, "Volga", "Volgan"],
  [32, 39, "Anatolia", "Anatolian"],
  [44, 42, "Caucasia", "Caucasian"],
  [36, 32, "Levant", "Levantine"],
  [44, 33, "Mesopotamia", "Mesopotamian"],
  [53, 32, "Persia", "Persian"],
  [45, 23, "Arabia", "Arabian"],
  [32, 26, "Nile", "Nilotic"],
  [-5, 31, "Atlas", "Atlas"],
  [4, 28, "Sahara", "Saharan"],
  [10, 35, "Carthage", "Carthaginian"],
  [-10, 13, "Sahel", "Sahelian"],
  [5, 8, "Niger", "Nigerian"],
  [24, 7, "Ubangi", "Ubangian"],
  [24, -5, "Congo", "Congolese"],
  [39, 9, "Abyssinia", "Abyssinian"],
  [38, -6, "Swahili Coast", "Swahili"],
  [29, -19, "Zambezi", "Zambezian"],
  [24, -29, "Kalahari", "Kalahari"],
  [19, -34, "Cape", "Cape"],
  [47, -20, "Madagascar", "Malagasy"],
  [67, 42, "Transoxiana", "Transoxian"],
  [69, 30, "Indus", "Indus"],
  [78, 28, "Ganges", "Gangetic"],
  [77, 16, "Deccan", "Deccani"],
  [89, 24, "Bengal", "Bengali"],
  [86, 31, "Himalaya", "Himalayan"],
  [94, 37, "Tibet", "Tibetan"],
  [82, 46, "Tarim", "Tarim"],
  [105, 47, "Mongolia", "Mongolian"],
  [111, 35, "Jade River", "Jade"],
  [114, 24, "Pearl River", "Pearl"],
  [104, 27, "Yunnan", "Yunnan"],
  [104, 16, "Mekong", "Mekong"],
  [98, 7, "Malaya", "Malayan"],
  [117, -1, "Borneo", "Bornean"],
  [110, -7, "Java", "Javanese"],
  [101, -1, "Sumatra", "Sumatran"],
  [122, 13, "Luzon", "Luzonian"],
  [128, 37, "Korea", "Korean"],
  [138, 37, "Yamato", "Yamato"],
  [130, 46, "Amur", "Amur"],
  [65, 58, "Ural", "Uralic"],
  [89, 60, "Siberia", "Siberian"],
  [124, 65, "Lena", "Lena"],
  [160, 61, "Kamchatka", "Kamchatkan"],
  [119, -25, "Westreach", "Westreach"],
  [133, -25, "Red Centre", "Redstone"],
  [149, -28, "Coral Coast", "Coral"],
  [140, -36, "Southern Cross", "Austral"],
  [146, -6, "Papua", "Papuan"],
  [173, -41, "Aotearoa", "Aotearoan"],
  [178, -17, "Fiji", "Fijian"],
];
const hash = (text) => {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
};
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
export function capitalCoordinates(s, cell) {
  const map = REAL_MAPS[s.preset];
  if (!map) return null;
  const [west, south, east, north] = map.bounds;
  const longitude = west + (((cell % W) + 0.5) / W) * (east - west);
  const projected =
    merc(north) -
    ((Math.floor(cell / W) + 0.5) / H) * (merc(north) - merc(south));
  return {
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
    latitude:
      ((2 * Math.atan(Math.exp(projected)) - Math.PI / 2) * 180) / Math.PI,
  };
}
function sphereDistance(lon, lat, anchor) {
  const radians = Math.PI / 180,
    dy = (anchor[1] - lat) * radians,
    dx = (anchor[0] - lon) * radians;
  return (
    Math.sin(dy / 2) ** 2 +
    Math.cos(lat * radians) *
      Math.cos(anchor[1] * radians) *
      Math.sin(dx / 2) ** 2
  );
}
function adjacent(i) {
  return [
    i % W ? i - 1 : -1,
    i % W < W - 1 ? i + 1 : -1,
    i >= W ? i - W : -1,
    i < W * (H - 1) ? i + W : -1,
  ].filter((j) => j >= 0);
}
export function capitalRegion(s, cell) {
  const coords = capitalCoordinates(s, cell);
  if (coords) {
    const anchor = REGIONS.reduce((best, a) =>
      sphereDistance(coords.longitude, coords.latitude, a) <
      sphereDistance(coords.longitude, coords.latitude, best)
        ? a
        : best,
    );
    return { noun: anchor[2], adjective: anchor[3], label: anchor[2] };
  }
  const x = cell % W,
    y = Math.floor(cell / W),
    north = y < H * 0.25,
    south = y > H * 0.75;
  const coast = adjacent(cell).some((i) => s.terrain[i] <= 0),
    mountain = s.terrain[cell] > 0.28;
  // Small connected land masses receive island identities even when their capital is inland.
  const queue = [cell],
    seen = new Set(queue);
  for (let head = 0; head < queue.length && queue.length <= 100; head++)
    for (const j of adjacent(queue[head]))
      if (s.terrain[j] > 0 && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
  const island = queue.length <= 100;
  let noun, label;
  if (mountain) {
    noun = north ? "Frostspire" : south ? "Sunspire" : "Ironpeak";
    label = "Highlands";
  } else if (island) {
    noun = north ? "Frost Isles" : south ? "Ember Isles" : "Azure Isles";
    label = "Island realm";
  } else if (coast) {
    noun = north
      ? "Winterhaven"
      : south
        ? "Sunhaven"
        : x < W / 2
          ? "Duskshore"
          : "Dawnshore";
    label = "Coastal realm";
  } else {
    noun = north
      ? "Wintermarch"
      : south
        ? "Sunmarch"
        : x < W / 2
          ? "Westmere"
          : "Dawnvale";
    label = "Interior realm";
  }
  return { noun, adjective: noun, label };
}
export function generateNationName(
  s,
  capital,
  { excludeId = null, revolution = false } = {},
) {
  const region = capitalRegion(s, capital),
    key = hash(`${s.seed}:${capital}:${region.noun}`);
  const candidates = revolution
    ? [
        `Free ${region.noun}`,
        `${region.adjective} Republic`,
        `${region.noun} Freeholds`,
        `${region.adjective} Union`,
      ]
    : [
        `Crown of ${region.noun}`,
        `${region.adjective} League`,
        `${region.noun} Dominion`,
        `${region.adjective} Commonwealth`,
        `${region.noun} Imperium`,
        `${region.adjective} Confederacy`,
        `${region.noun} Pact`,
        `${region.noun} Freeholds`,
      ];
  const used = new Set(
    s.nations
      .filter((n) => n.id !== excludeId)
      .map((n) => n.name.toLowerCase()),
  );
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[(key + i) % candidates.length];
    if (!used.has(name.toLowerCase())) return name;
  }
  const base = candidates[key % candidates.length];
  for (let number = 2; ; number++) {
    const name = `${base} ${number}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
