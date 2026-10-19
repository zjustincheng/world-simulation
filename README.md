# World Simulation — Conflict Sandbox

A playable browser world-war sandbox inspired by Ages of Conflict. Spawn nations, redraw the world, and advance from one major historical event to the next as economies, alliances, revolutions, and wars change borders.

[Play the private hosted game](https://world-simulation-atlas.gentlelarch6.chatgpt.site)

## Run locally

Requires Node.js 20.11 or newer. No dependencies or build step.

```sh
cd game
npm run dev
```

Open http://127.0.0.1:5187. Set `PORT` to use another port. Run simulation tests with `npm test` from `game/`.

## Play

- Start on an unclaimed Earth map, ready for your own nations. Click **Spawn nation**, choose a name, color, and starting size, then click land. Repeat and press **Finish setup**. Undo removes the last placement. Right-drag pans while placing.
- Use **Place countries for me** in the setup panel to add 6, 12, 24, or 32 countries and immediately divide all land among them, including disconnected islands. Existing territory stays intact, and Undo restores the entire previous map.
- Sound effects mark founding, peaceful developments, and conflict. **Sound on/off** mutes them and remembers your preference; audio starts only after interaction.
- Choose Earth, Europe, Asia, Africa, North America, South America, or Australia & Oceania in **New world**. These use real coastlines with empty political borders. Each has a map preview.
- Generated continents, Pangaea, an archipelago, an all-land arena, and a blank canvas remain available. Choose **I'll place them myself**, or automatically generate 6–32 nations with established borders covering all land.
- Select a nation on the map or ranking. Inspect territory, gold, combat efficiency, stability, allies, and enemies.
- Use god mode to donate gold, force war or peace, toggle an alliance, annex a target, trigger a revolt, or collapse a nation. Names, colors, efficiency, and stability are editable.
- Leave a new nation's name blank to derive it from its capital: regional inspirations on real-world maps and terrain/latitude on generated maps. Hover in Spawn mode to preview the name. Existing nations can use **Edit nation → Name from capital**. Revolutions get names from their own capital region, and names remain stable when capitals relocate.
- Paint land, sea, ownership, or unclaimed territory. Spawn new nations on land. Time advances only when you choose; undo restores the last map stroke. Up to 64 nations can exist in a world's history.
- Watch highlighted fronts, capture effects, capital losses, naval landings, and fallen nations. Switch between political, diplomacy, and terrain views.
- Click **Next event** or press Space to advance through a larger world chapter, ending at substantial territorial changes, resolved wars, revolutions, or a major expansion. Early diplomatic notices no longer end a chapter on their own. There is no year-length selector: elapsed time depends on what happens. Quiet years and minor battles run in the background. Read a world summary with every ongoing or newly concluded war, its causes and outcomes, active alliances, alliance changes, new states, fallen nations, peace agreements, and current crises, then choose **Watch this event** to animate the net territory changes. **Pause / Resume**, **Finish**, and **Replay border changes** control playback without advancing history. The **Event** report lists territory gains and losses. Toggle **Changes** to hide map highlights. Nothing advances while you read or plan; drag to pan and scroll to zoom.

- Configure AI, expansion, automatic wars, alliances, revolutions, and diplomatic pressure. World War declares war between every living nation.
- Save up to six named worlds in the Save/Load library. Load, replace, or delete individual slots. Earlier single-slot saves remain available. Export/import portable JSON worlds.
- Recover your last session after a reload. Automatic recovery writes every five seconds and when leaving the page, and waits for your next event. Recovery stays separate from your named saves.
- Open **Wars** to track each side's captured tiles, jump to a nation, or negotiate peace. Peace treaties block AI declarations between those nations for 15 years; god mode can override them.
- On touchscreens, pinch with two fingers to zoom and pan. An editor gesture that becomes a pinch cancels the first finger's placement or painting.

## Simulation

The engine is deterministic from its seed. Nations expand into neutral land. Conquest advances through connected frontier patches. Combat depends on territory, gold, combat efficiency, stability, allied support, and simultaneous fronts. Mountains slow conquest. Colonization and naval invasions require a connected water route of at most four water tiles from an owned coast. The closest reachable shore is chosen; intervening land and map edges block travel. AI nations only declare overseas wars on reachable coastal neighbors. Nearby island hopping remains possible, while unlimited ocean crossings are prevented. Territory earns gold; multiple wars drain it. Low reserves reduce combat efficiency, and low stability can trigger connected revolutions. Capitals relocate after capture, and countries with no land fall.

Wars no longer use random declaration rolls. Stable neighbors can remain at peace indefinitely. Territorial ambition (an expansionist government's policy), recorded territorial losses, expansion on a shared frontier, and the ending of an alliance can create disputes. Disputes pass through formal protests, negotiations, and mobilization over multiple years. Governments need a reachable opponent, adequate treasury and stability, a viable military balance, and no existing front before initiating an ordinary war. Less aggressive or overmatched governments can settle at the current frontier. Diplomatic pressure changes escalation speed, not the requirement for a cause.

The **Wars** panel shows active crises and their origins, each war's stated cause, truces, and recent settlements. Wars end through territorial outcomes, exhaustion, or prolonged stalemate; treaties recognize the current frontier and relinquish claims. Dispute memory and a bounded war chronicle survive saves. Existing saves without these fields migrate with empty records; unrecorded older war causes are shown as unknown. Player-forced wars are explicitly labeled as interventions, while rebellions state their independence claim. These are fictional, simplified political motivations, not a claim that aggression is justified. Domestic investments require funds, wartime celebrations are restricted, and recently repeated stories are avoided.

The map is 160 × 100 tiles. Water is `-1`, neutral land is `-2`, and owned land stores the nation's ID. Simulation advances only when you request the next major event. A stable world returns an era-of-calm summary after at most 60 simulated years in peacetime so the search always finishes; disabled AI leaves time unchanged. Twenty narrative event stories include fires, harsh winters, court intrigue, field hospitals, schools, inventions, broken bridges, signaling reforms, and trade caravans, failed harvests, officer training, reconciliation, silver discoveries, stolen wages, roads, and festivals. Their reports show actual changes to gold, stability, and efficiency. Wars that begin in a chapter are followed through their settlement before that chapter ends; the border animation covers the full conflict from its opening year to the peace. Existing wars from older saves are clearly marked as already in progress. Small battles are combined into larger campaigns with net territorial outcomes. Land offensives cover larger patches; negotiated territorial settlements generally require a larger gain and at least eight years of fighting, unless other ending conditions apply. World chapters aim for an 8% territorial shift or substantial political outcomes rather than ending on the first minor notice. The event report keeps a multi-country roundup available after animation. Alliance and union sections report recorded developments only; they do not invent political unions. Playback labels the year and lights up recently changed tiles. Routine domestic stories remain in History; political milestones and substantial territorial changes determine when progression stops. A turn is committed after its animation; reloading during event reading or playback restores the world from before that turn. The latest turn report is session-only; event history is saved with the world. Named saves are manual; session recovery is automatic. Browser storage is local to the device and site origin and subject to browser quota. Export important worlds for a portable backup. This is an independent sandbox with original code and visuals, not a recreation of another game's complete rules or assets.

## Structure and validation

- `game/dist/diplomacy.js`: persistent grievances, deliberate territorial policies, crisis escalation, negotiations, and condition-based settlements
- `game/dist/engine.js`: seeded world generation, conquest, economy, diplomacy, editing, save migration and validation
- `game/dist/app.js`: canvas renderer, manual nation placement, map editor, war room, touch gestures and god mode
- `game/dist/setup.js`: deterministic automatic capital placement without overwriting existing countries
- `game/dist/sound.js`: synthesized audio cues and persistent mute preference
- `game/dist/turns.js`: major-event progression, campaign summaries, domestic events, and territory change reports (legacy fixed-year helper retained for regression coverage)
- `game/dist/names.js`: deterministic capital-based naming, geographic inspirations, terrain names, and duplicate avoidance
- `game/dist/saves.js`: six-slot save library, legacy save migration, and separate session recovery
- `game/dist/real-maps.js`: seven bundled geographic land masks; no runtime map download
- `game/scripts/build-real-maps.py`: reproducible GeoJSON-to-map conversion
- `game/dist/index.html`, `style.css`: responsive game interface
- `game/test/engine.test.mjs`: seeded presets, 400-year invariants, expansion, diplomacy, conquest, connected revolts, editing, AI settings and saves

Browser checks cover diplomacy, nation editing, paint/spawn/undo, named save replacement/deletion, recovery across reloads, export/import, war-room peace treaties, turn controls and reports, mobile layout, and two-finger pinch navigation. Storage tests cover full slots, quota failures, corruption, migration, and recovery reproducibility.

## Geographic data

Real-world coastlines are derived from [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), which is [public domain](https://www.naturalearthdata.com/about/terms-of-use/). The game uses aspect-preserving Mercator views sampled onto its 160 × 100 grid; small islands and coastline detail are simplified. Real-world presets provide geography, not present-day political borders.

To regenerate the bundled maps after downloading the source GeoJSON:

```sh
python3 game/scripts/build-real-maps.py /path/to/ne_110m_land.geojson
```

The generated file records the source SHA-256. Geographic tests check fixed coastlines across seeds and known land/ocean landmarks for all seven maps.

Sea-travel regression tests cover range limits, land barriers, map edges, nearby colonization, distant forced wars, AI rival selection, and lost launch coasts.

Regional names are fictional political names inspired by nearby geographic anchors, not a claim about modern borders or historical sovereignty. Name generation uses its own deterministic hash and does not consume simulation randomness. Custom names and existing saved names are retained.
