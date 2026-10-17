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

- Generate continents, Pangaea, an archipelago, an all-land arena, or a blank canvas. Start with 6–32 nations and established borders or expanding settlements.
- Select a nation on the map or ranking. Inspect territory, gold, combat efficiency, stability, allies, and enemies.
- Use god mode to donate gold, force war or peace, toggle an alliance, annex a target, trigger a revolt, or collapse a nation. Names, colors, efficiency, and stability are editable.
- Paint land, sea, ownership, or unclaimed territory. Spawn new nations on land. Editing pauses time; undo restores the last map stroke. Up to 64 nations can exist in a world's history.
- Watch highlighted fronts, capture effects, capital losses, naval landings, and fallen nations. Switch between political, diplomacy, and terrain views.
- Pause, step one year, or run at 1×, 3×, 10×, or 30× speed. Space toggles playback; Escape returns to Inspect. Drag to pan and scroll to zoom.
- Configure AI, expansion, automatic wars, alliances, revolutions, and war frequency. World War declares war between every living nation.
- Save/load one world in browser storage or export/import portable JSON worlds. Earlier v1 saves migrate automatically.

## Simulation

The engine is deterministic from its seed. Nations expand into neutral land. Conquest advances through connected frontier patches. Combat depends on territory, gold, combat efficiency, stability, allied support, and simultaneous fronts. Mountains slow conquest. Coastal nations can land across the sea. Territory earns gold; multiple wars drain it. Low reserves reduce combat efficiency, and low stability can trigger connected revolutions. Capitals relocate after capture, and countries with no land fall.

The map is 160 × 100 tiles. Water is `-1`, neutral land is `-2`, and owned land stores the nation's ID. Simulation advances while the page is open. Saves are manual, and browser storage is local to the device and site origin. This is an independent sandbox with original code and visuals, not a recreation of another game's complete rules or assets.

## Structure and validation

- `game/dist/engine.js`: seeded world generation, conquest, economy, diplomacy, editing, save migration and validation
- `game/dist/app.js`: canvas renderer, map editor, god mode and browser persistence
- `game/dist/index.html`, `style.css`: responsive game interface
- `game/test/engine.test.mjs`: seeded presets, 400-year invariants, expansion, diplomacy, conquest, connected revolts, editing, AI settings and saves

Browser checks cover diplomacy, nation editing, paint/spawn/undo, save/load, export/import, 30× world war, and mobile layout.
