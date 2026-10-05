# Progress — release 0.2

## DONE

- Created playable TypeScript/Vite/Canvas game from an empty repository.
- Seeded galaxy: 25 systems, 5 regions, 10 biomes, 25 stations, 13 outposts, planets, derelicts, anomalies and asteroid fields.
- Walkable ship, repair introduction, inertia flight, touch controls, autopilot with docking alignment, landing, mining and ruin archives.
- Six body parts, bleeding, blood, oxygen, pain, consciousness, temperature/radiation, targeted medications.
- Projectile combat, five distinct phased bosses, five campaign chapters, three final choices and continuing exploration.
- Trading, six compact contract types, crafting, 54 working technologies, five ship classes with 6/8/10 real compartments, ship and character customization.
- Separate suit container (35 kg / 12 slots) and cargo (40 slots, class-dependent weight), stack limits, transfers, automatic resource unloading and four quick supply slots.
- Boarding disabled pirates and derelicts, hostile crew/robots, projectile combat inside, one-time salvage; EVA external repair at the parked ship.
- Fires damage compartments and spread; suppression upgrade works. Capped pooled explosion particles, damage shake and jump/landing transitions honor reduced-effects mode.
- Mobile flight uses a wider camera and keeps radio messages away from the player, so close-range enemy ships remain visible.
- Three validated save slots, autosave, JSON import/export and last-good backups. Synthesized audio, settings, medical body diagram, codex.
- 26 unit/integration tests pass, including actual projectile victories against all five bosses, legacy-save migration and out-of-order intro repairs. Production build passes; JS is about 120 KB before gzip. Dependency audit reports 0 vulnerabilities.
- Chromium and iPhone-sized WebKit passed UI acceptance: introduction → flight → docking → market → contract → save/reload → upgrade → landing → ruin → takeoff → first boss victory. The initial published release also passed live browser checks.
- GitHub Pages enabled through API, source GitHub Actions. First deployment succeeded. No GitHub settings action is required from the user.
- Public game: https://epictouch22.github.io/STARFALL-VOID-FRONTIER/. Every main push runs locked install, 26 tests, build, base-path verification and Chromium/WebKit acceptance before deployment. CI stores screenshots.

## IN PROGRESS

- Release 0.2 expands the initial playable campaign; the full large design brief still needs the depth listed below.

## NEXT

- Implement a true cross-system delivery contract: accept at port A, reserve cargo and store destination system/port, deliver only at port B, award faction reputation once. Update quest markers and galaxy route display; test cargo reservation, save migration and duplicate reward prevention. Then add passenger/escort/rescue variants using that objective structure. Ship a tested checkpoint to main.

## KNOWN BUGS

- No known blocker in the tested acceptance paths. A full multi-hour playthrough and real iPhone hardware performance have not been verified.
- Planet caves/wrecks are resource nodes rather than separate submaps; terrain has no solid obstacles, varied weather or biome-specific fauna AI yet.
- Inventory transfers use buttons; drag-and-drop, dropped-item world containers and additional equipment slots remain to implement.
- Contracts use six compact objective types; passenger, missing person, escort and evacuation chains need expansion. Delivery/repair contracts currently consume items at any port rather than requiring a specific destination.
- Events have 32 names and grouped simulation effects; interactive event choices need expansion.
- Flooding/coolant simulation, targeted enemy modules, capturable enemy ships, hidden mini-boss/legendary equipment, richer faction/NPC histories and boss weak-point interactions remain planned. Bosses have real phases and distinct attacks.
- There are no procedural moons, moving merchant docking ports or independent station submaps yet. Reactor/engine/oxygen/shield integrity affects ship systems; cable networks are compact upgrade effects rather than a tile wiring simulation.
- Real iPhone Safari hardware has not been tested. Automated WebKit emulation is a compatibility check, not a hardware guarantee.

## IMPORTANT ARCHITECTURE

- Read GAME_DESIGN.md, ARCHITECTURE.md, ROADMAP.md and this file before continuing.
- No backend. Canvas world with DOM UI. Browser localStorage, 3 slots.
- Save format 2 migrates published format 1. Keep existing `starfall-save-v1-*` storage keys to preserve deployed saves. Validate checksum before migration and nested schema after it.
- Galaxy PRNG and IDs must remain stable for existing seeds. Runtime input, particles and renderer caches are not save data.
- Production base is `/STARFALL-VOID-FRONTIER/`. `scripts/verify-build.mjs` checks emitted asset prefixes and files. `npm run test:browser` expects a production preview at port 4173 or GAME_URL.
- Main repository: epictouch22/STARFALL-VOID-FRONTIER.
