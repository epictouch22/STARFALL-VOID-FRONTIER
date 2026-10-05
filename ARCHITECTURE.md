# Architecture

- TypeScript + Vite, native Canvas 2D renderer, DOM interface. No backend, external media, runtime API or framework is required.
- `src/data`: declarative items, biomes, ships, technologies, chapters and events.
- `src/world`: deterministic PRNG and seeded galaxy, local surface generation.
- `src/core`: serialized state, actions and time-based simulation. UI dispatches actions; rendering reads state. Current location is an explicit mode.
- `src/scenes`: drawing of space, planet surfaces and compartment interiors. Only current system is simulated.
- `src/input`: keyboard and pointer/touch controls with cancellation handling.
- `src/ui`: menus and telemetry, event-driven updates with limited HUD frequency.
- `src/save`: three versioned, validated, checksum-protected localStorage slots with last-good backups and JSON import/export.
- `src/audio`: user-gesture-initialized Web Audio synthesis.
- `tests`: meaningful rules, deterministic generation and campaign progression.

Production base is `/STARFALL-VOID-FRONTIER/`. All media is procedural; Vite emits JS and CSS with the configured prefix. GitHub Actions installs locked dependencies, tests, builds and publishes `dist` through the official Pages artifact workflow.

State is intentionally plain JSON. Frame-only particles and input do not enter save files. Fixed-step simulation clamps elapsed time and pauses on backgrounding. New save versions need explicit migrations and validation.
