# Architecture

- TypeScript + Vite, native Canvas 2D renderer, DOM interface. No backend, external media, runtime API or framework is required.
- `src/data`: declarative items, biomes, ships, technologies, chapters and events.
- `src/world`: deterministic PRNG and seeded galaxy, local surface generation.
- `src/core`: serialized state, actions and time-based simulation. UI dispatches actions; rendering reads state. Current location is an explicit mode.
- `src/scenes`: drawing of space, planet surfaces and compartment interiors. Only current system is simulated.
- `src/input`: keyboard and pointer/touch controls with cancellation handling.
- `src/ui`: menus and telemetry, event-driven updates with limited HUD frequency.
- `src/save`: format 6 with explicit format-1–5 migrations; three validated, checksum-protected localStorage slots with last-good backups and JSON import/export. Storage keys retain `v1` for browser compatibility.
- `src/audio`: user-gesture-initialized Web Audio synthesis.
- `tests`: meaningful rules, deterministic generation and campaign progression.

Production base is `/STARFALL-VOID-FRONTIER/`. All media is procedural; Vite emits JS and CSS with the configured prefix. GitHub Actions installs locked dependencies, tests, builds and publishes `dist` through the official Pages artifact workflow.

State is intentionally plain JSON. Frame-only pooled particles and input do not enter save files. Fixed-step simulation clamps elapsed time and pauses on backgrounding. `core/inventory.ts` handles capacity and container transfers; `core/boarding.ts` handles derelict entry and salvage. Ship upgrades and classes influence real compartment integrity and capacity. New save versions need explicit migrations and validation.

Mission manifests are separate from disposable item pools and reserve cargo weight/slots. `core/escort.ts` owns saved convoy movement, jump proximity, ambush and hull damage; actions, simulation, renderer and UI share this state. Completed, cancelled and failed objectives cannot reward again.

## Rework foundation

MASTER_REWORK.md supersedes ending-first priorities. `core/encounters.ts` + `data/encounters.ts` own saved choices, preflight atomic capacity and once-only effects. `State.activity` is simulated timed work, cancelled by leaving range; only completion spends parts. `State.chronicle` stores up to 1000 significant results. Save 5 migration initialized new fields and appends Institute reputation; v1 storage keys remain intact. `physical=false` preserves old published saves, while New Game uses physical interactions and optional investigation.

Physical port checkpoint: core/docking.ts owns permission/envelope/capture/pressure/gates. world/stations.ts supplies deterministic shared collision/render floors with a bounded cache. core/residents.ts owns saved identity, physical shifts, range-gated services and paid engineer jobs. Save 6 validates actors/jobs/gates and migrates v5 station occupancy into a ready moored ship. Legacy saves stay physical=false. Menus pause simulation; engineering resumes when closed.
