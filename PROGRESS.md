# Progress — release 0.4 (2026-10-05)

## DONE

- Audited GAME_DESIGN, ARCHITECTURE, ROADMAP, PROGRESS, README, recent commits, actual code and the original brief. QA_AUDIT.md separates implemented loops from missing depth; the entire original brief is not complete.
- Preserved seeded 25-system / 5-region galaxy, over 60 planets, 10 biomes, 25 ports, 13 outposts, repair introduction, flight physics, scanner, autopilot, docking, landing, mining and archives.
- Preserved six-part medicine, module emergencies/fire/breaches, EVA repairs, guarded boarding, projectile combat, crafting, market, 54 technology effects, five ship classes and appearance customization.
- Preserved suit/cargo containers, weight/slots/stacks, transfers/unloading, quick slots, local saves/backups/import/export, procedural graphics/audio and touch controls.
- Completed the previous NEXT task: true cross-system delivery with exact ports, issued sealed manifests, reserved cargo capacity, route/map/world markers, cancellation and once-only rewards. Player medicine is separate from freight.
- Added passenger transport and missing-crew rescue: board the specified derelict, defeat guards, reach its terminal, evacuate survivors and return to the origin port. Already salvaged wrecks can still yield mission survivors.
- Added physical convoy escort: visible allied ship, radar/HUD hull, follow movement, 250 m jump constraint, pirate ambush, enemy projectile damage, persistent failure with reputation penalty, and payment only after safe arrival at the specified port. Nine contract types now exist.
- Save format 4 migrates published formats 1/2/3. Legacy accepted deliveries retain original terms; active v3 freight retains destinations, manifests and progress. Existing browser storage keys remain unchanged.
- Fixed reversed sale reputation, overloaded ship downsizing, suit-quantity buttons, one-frame stimulant duration, unsafe nested-save validation, adaptive shield damage leaking into hull, ground kills counting as ship bounties, and station service omitting shield recharge.
- Fixed destructive recycling when output does not fit and wasteful use of full fuel/oxygen/food/hull reserves. Iron recycling button is explicitly unavailable.
- Additional mobile QA fixed a 31px menu button and overlapping HUD at maximum scale. HUD scales once and fits narrow screens; all tested touch targets are at least 44px.
- Added an earned full-campaign integration test: actual repair/movement/actions, convoy trip, paid equipment, all five projectile bosses, save/reload between chapters, ending and further travel. No money/health/unlock/position/boss-HP injection.
- Extended production browser acceptance from New Game through delivery/passengers/escort, reload, earned equipment, all five bosses, ending, reload and free play. Runtime save data is read only for assertions/aiming; no debug or save mutation.
- Stable milestones already pushed: 431fe62 (routed missions) and 195a41f (full campaign/combat QA). Both deployed successfully; Actions runs 37279171439 and 37280367040 passed.
- GitHub Pages is active with GitHub Actions as source. Every main push installs locked dependencies, tests, builds, checks Pages asset paths and runs Chromium/WebKit acceptance before deployment. No GitHub settings action is needed.
- Public game: https://epictouch22.github.io/STARFALL-VOID-FRONTIER/.

## IN PROGRESS

- ROADMAP stage 6: mission depth has expanded; event choices, physical planet interiors and remaining original-brief depth are still development work. No unfinished source changes are intended at the session checkpoint.

## NEXT

- Implement saved interactive encounter choices for three concrete events: SOS, cargo inspection and ancient beacon. Add data-driven choice definitions and core resolution with actual resource/reputation/damage/route consequences, once-only resolution and atomic capacity handling. Surface a usable encounter panel on PC/iPhone, migrate saves, test pending/declined/resolved states and reload, then typecheck/test/build and push main. Keep existing campaign/mission acceptance passing.

## KNOWN BUGS

- No known blocker in tested New Game → ending paths. Human multi-hour exploration and physical iPhone Safari hardware/performance remain unverified.
- Planets have cave/wreck resource nodes, not independent interiors or solid terrain. Weather, distinct fauna AI, moons and surface bases remain absent.
- Inventory lacks drag-and-drop, world dropped-item containers and equipment slots.
- Repair contracts are honestly labelled port supply requisitions; physical NPC ship repair, smuggling and evacuation chains remain absent. Escort simulates the active system and pauses with other space combat when the player enters an interior.
- Events have 32 labels with grouped effects; interactive choices and independent encounters remain incomplete.
- Flooding/coolant, detailed wiring/pressure volumes, targeted enemy modules, captured vessels, merchant docking, boss weak points, hidden mini-bosses, legendary equipment and richer faction/NPC histories remain absent.
- Original content targets (100 items, 20 enemy/weapon variants, 30 quest templates), selectable Explorer/Normal/Survivor difficulty and parts of appearance customization remain unfulfilled. Current seven weapons and compact regional AI work.

## IMPORTANT ARCHITECTURE

- Read the five project documents and QA_AUDIT.md before further development. Canvas world plus DOM UI; no backend.
- Save format 4; preserve `starfall-save-v1-*` storage keys, verify checksum before migration and nested data afterwards. Never silently reinterpret accepted legacy contracts.
- Do not change seeded PRNG/IDs without migration. Input, particles and render caches stay out of saves.
- Mission manifests reserve cargo but never enter disposable item pools. Escorts have their own saved ship state; `core/escort.ts` is wired into jump, simulation, damage, renderer and UI.
- Pages base: `/STARFALL-VOID-FRONTIER/`. `verify-build.mjs` checks emitted paths/files. Browser acceptance requires production preview port 4173 or GAME_URL.

## TEST STATUS

- `npm run typecheck`: PASS. `npm test`: 50 tests PASS across five files.
- Earned five-chapter core campaign including physical escort: PASS.
- Full Chromium production UI campaign with escort: PASS. Full iPhone WebKit production UI campaign with escort: PASS.
- Dependency audit: 0 vulnerabilities. Physical iPhone hardware not tested.
- `scripts/mobile-check.mjs`: WebKit 320×568, 390×664 and 844×390, minimum/maximum settings, visible 44px controls and non-overlapping HUD PASS; included in CI.

## BUILD STATUS

- Production build and Pages asset verification: PASS. Procedural images/audio need no additional asset paths or backend.
- Existing deployment workflow retained. Release 0.4 uses this same automatic deployment. `scripts/live-check.mjs` verifies published JS/CSS contents against dist and opens New Game/all 12 panels/saves in Chromium and iPhone WebKit.
