# World Simulation — Conflict Sandbox

A playable browser world-war sandbox inspired by Ages of Conflict. Spawn nations, redraw the world, and watch economies, alliances, revolutions, and wars drive changing borders.

[Play the private hosted game](https://world-simulation-atlas.gentlelarch6.chatgpt.site)

## Run locally

Requires Node.js 20.11 or newer. No dependencies or build step.

```sh
cd game
npm run dev
```

Open http://127.0.0.1:5187. Set `PORT` to use another port. Run simulation tests with `npm test` from `game/`.

## Play

- Start on an unclaimed Earth map, paused and ready for your own nations. Click **Spawn nation**, choose a name, color, and starting size, then click land. Repeat and press **Start simulation**. Undo removes the last placement. Right-drag pans while placing.
- Choose Earth, Europe, Asia, Africa, North America, South America, or Australia & Oceania in **New world**. These use real coastlines with empty political borders. Each has a map preview.
- Generated continents, Pangaea, an archipelago, an all-land arena, and a blank canvas remain available. Choose **I'll place them myself**, or automatically generate 6–32 nations with established borders or expanding settlements.
- Select a nation on the map or ranking. Inspect territory, gold, combat efficiency, stability, allies, and enemies.
- Use god mode to donate gold, force war or peace, toggle an alliance, annex a target, trigger a revolt, or collapse a nation. Names, colors, efficiency, and stability are editable.
- Leave a new nation's name blank to derive it from its capital: regional inspirations on real-world maps and terrain/latitude on generated maps. Hover in Spawn mode to preview the name. Existing nations can use **Edit nation → Name from capital**. Revolutions get names from their own capital region, and names remain stable when capitals relocate.
- Paint land, sea, ownership, or unclaimed territory. Spawn new nations on land. Editing pauses time; undo restores the last map stroke. Up to 64 nations can exist in a world's history.
- Watch highlighted fronts, capture effects, capital losses, naval landings, and fallen nations. Switch between political, diplomacy, and terrain views.
- Pause, step one year, or run at 1×, 3×, 10×, or 30× speed. Space toggles playback; Escape returns to Inspect. Drag to pan and scroll to zoom.
- Configure AI, expansion, automatic wars, alliances, revolutions, and war frequency. World War declares war between every living nation.
- Save up to six named worlds in the Save/Load library. Load, replace, or delete individual slots. Earlier single-slot saves remain available. Export/import portable JSON worlds.
- Recover your last session after a reload. Automatic recovery writes every five seconds and when leaving the page, and resumes paused. Recovery stays separate from your named saves.
- Open **Wars** to track each side's captured tiles, jump to a nation, or negotiate peace. Peace treaties block AI declarations between those nations for 15 years; god mode can override them.
- On touchscreens, pinch with two fingers to zoom and pan. An editor gesture that becomes a pinch cancels the first finger's placement or painting.

## Simulation

The engine is deterministic from its seed. Nations expand into neutral land. Conquest advances through connected frontier patches. Combat depends on territory, gold, combat efficiency, stability, allied support, and simultaneous fronts. Mountains slow conquest. Colonization and naval invasions require a connected water route of at most four water tiles from an owned coast. The closest reachable shore is chosen; intervening land and map edges block travel. AI nations only declare overseas wars on reachable coastal neighbors. Nearby island hopping remains possible, while unlimited ocean crossings are prevented. Territory earns gold; multiple wars drain it. Low reserves reduce combat efficiency, and low stability can trigger connected revolutions. Capitals relocate after capture, and countries with no land fall.

The map is 160 × 100 tiles. Water is `-1`, neutral land is `-2`, and owned land stores the nation's ID. Simulation advances while the page is open. Named saves are manual; session recovery is automatic. Browser storage is local to the device and site origin and subject to browser quota. Export important worlds for a portable backup. This is an independent sandbox with original code and visuals, not a recreation of another game's complete rules or assets.

## Structure and validation

- `game/dist/engine.js`: seeded world generation, conquest, economy, diplomacy, editing, save migration and validation
- `game/dist/app.js`: canvas renderer, manual nation placement, map editor, war room, touch gestures and god mode
- `game/dist/names.js`: deterministic capital-based naming, geographic inspirations, terrain names, and duplicate avoidance
- `game/dist/saves.js`: six-slot save library, legacy save migration, and separate session recovery
- `game/dist/real-maps.js`: seven bundled geographic land masks; no runtime map download
- `game/scripts/build-real-maps.py`: reproducible GeoJSON-to-map conversion
- `game/dist/index.html`, `style.css`: responsive game interface
- `game/test/engine.test.mjs`: seeded presets, 400-year invariants, expansion, diplomacy, conquest, connected revolts, editing, AI settings and saves

Browser checks cover diplomacy, nation editing, paint/spawn/undo, named save replacement/deletion, recovery across reloads, export/import, war-room peace treaties, 30× world war, mobile layout, and two-finger pinch navigation. Storage tests cover full slots, quota failures, corruption, migration, and recovery reproducibility.

## Geographic data

Real-world coastlines are derived from [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), which is [public domain](https://www.naturalearthdata.com/about/terms-of-use/). The game uses aspect-preserving Mercator views sampled onto its 160 × 100 grid; small islands and coastline detail are simplified. Real-world presets provide geography, not present-day political borders.

To regenerate the bundled maps after downloading the source GeoJSON:

```sh
python3 game/scripts/build-real-maps.py /path/to/ne_110m_land.geojson
```

The generated file records the source SHA-256. Geographic tests check fixed coastlines across seeds and known land/ocean landmarks for all seven maps.

Sea-travel regression tests cover range limits, land barriers, map edges, nearby colonization, distant forced wars, AI rival selection, and lost launch coasts.

Regional names are fictional political names inspired by nearby geographic anchors, not a claim about modern borders or historical sovereignty. Name generation uses its own deterministic hash and does not consume simulation randomness. Custom names and existing saved names are retained.
