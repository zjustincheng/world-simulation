# World Simulation

An original browser-based geopolitical sandbox inspired by the idea of watching fantasy history unfold. Generate a seeded world, watch nations fight and form alliances, or intervene with blessings, peace accords, and rebellions.

## Run locally

Requires Node.js 20 or newer. No dependencies or build step.

```sh
cd game
npm run dev
```

Open http://127.0.0.1:5187. Run simulation tests with `npm test` from `game/`.

## Play

- Select a nation on the map or in the world powers list.
- Pause, advance one year, or run at 1×, 3×, and 10× speed. Space toggles playback.
- Drag to pan, scroll to zoom, and switch between political and terrain views.
- Inspect population, treasury, stability, allies, and enemies. Bless a nation, force peace, provoke rebellion, or declare war.
- Create worlds with a seed and 6, 8, or 12 founding nations.
- Save/load in browser storage or export/import a JSON world including its chronicle.

The simulation uses deterministic seeded randomness. Military outcomes depend on territory, wealth, and stability. War drains resources and stability; peace allows recovery. Weak states may split. Simulation advances only while the page is open. Saves are manual and browser-local; exported files are portable.

## Structure

- `game/dist/engine.js`: deterministic simulation and save validation
- `game/dist/app.js`: canvas renderer and interaction
- `game/dist/index.html`, `style.css`: responsive game interface
- `game/test/engine.test.mjs`: simulation invariants and save tests

This is an independent sandbox prototype, not an implementation of Fantasy Map Simulator's proprietary assets or rules.
