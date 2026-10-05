# Progress — physical ports 0.6 (2026-10-05)

## DONE

- Canonical rework source: MASTER_REWORK.md and LORE_BIBLE.md. Audited the five project documents, commits and actual implementation; REWORK_PLAN.md records KEEP/REWORK/REMOVE. The new expedition is a captain sandbox; optional regional network threats do not gate technology or travel. Older published saves preserve their original campaign behavior.
- Phase 1: timed, range-bound, cancellable repairs/search/clinic; atomic material/cargo checks; nine saved choices across SOS, inspection and ancient beacon; six canonical factions; persistent significant chronicle and uncertain, attributed lore.
- Phase 2: actual permission, assigned berth, alignment/speed envelope, magnetic capture, 4-second sealing and 4-second pressure equalization. Leaving the chair, opening both doors, walking the tunnel and reversing traversal are required. No docking teleport; departure waits for closed doors and workers.
- Seeded connected station rooms with collision geometry, founding/history and canonical port identities. Five named staff per visited port have saved positions, shifts, opinion, meetings and memories. Services require approaching the actual staff member; the same rules apply on touch.
- Paid engineering sends the actual staff member through open doors into the ship. Each module receives four seconds of work; hull, fuel and shields recover during work. Partial order/worker position persist; departure waits for the worker to return. Doors physically obstruct the worker.
- Welding station consumes parts only after completing physical work. Fixed a one-pixel ship/tunnel collision gap, inner-door navigation stopping outside the ship, and emergency rescue producing an invalid physical save. Recovery now returns to a valid moored ship; it does not bypass docking.
- Preserved actual flight/combat, scanning, landing, mining, six-part medicine, ship emergencies, cargo, equipment, 54 technology effects, nine contract types, freight/passengers/rescue and saved escort movement/failure. Legacy earned five-boss campaign remains tested, without reimplementing it.
- Save 6 migrates formats 1–5, retaining browser keys and accepted contract terms. v5 docked players migrate into the moored ship. Activity, gates, residents and engineering orders are deeply validated; checksum precedes migration.
- GitHub Pages and automatic main deployment already active. Published phase-1 commit f789d98 passed Actions run 37300630006. No GitHub settings action is required.

## IN PROGRESS

- Incremental MASTER_REWORK, not the entire hundred-system design. Station NPC foundation is implemented; recruitable permanent crew, storyteller profiles, callbacks and distant economy remain to be implemented.

## NEXT

- Implement physically boarding recruitable engineer/medic, saved needs/pay/injuries/permanent death and real ship work. Then replace unconditional physical-game random events with eligible ORION/MORRIGAN/HESPER story cards and consequences referring to prior saved decisions.

## KNOWN BUGS

- No blocker found in tested physical port/freight route. Real iPhone hardware performance and human multi-hour exploration remain unverified.
- Instant crafting, equipment installation, ship replacement and abstract freight/passenger manifests remain legacy simplifications awaiting later rework phases.
- Surface nodes are not independent cave interiors; weather/fauna/moons/bases, world dropped-item containers, wiring/gases by compartment, captured ships and distant economy are absent.
- No recruitable crew or director yet. Existing station shifts/memories do not constitute a full society simulation. Most old event families still use a timer.
- Original content counts, selectable difficulty, boss weak points and legendary items are unfinished. A hundred-hour campaign is not established by current QA.
- Escort only simulates active space; entering an interior pauses its combat.

## TEST STATUS

- Typecheck PASS; 76 tests across seven files PASS, including legacy earned campaign, atomic encounters and 11 physical-port checks.
- Production Chromium and iPhone WebKit: ordinary New Game → timed repair → request/physical docking/pressure → walk gates → named staff/lore → engineer work + reload → close gates/depart → actual cross-system delivery + reload PASS. No debug actions or save mutations.
- WebKit 320×568, 390×664, 844×390: minimum/maximum settings, visible 44px controls and non-overlapping HUD PASS.
- These checks establish the stated routes, not the complete MASTER_REWORK or real Safari hardware certification.

## BUILD STATUS

- Production build and emitted Pages JS/CSS path/file verification PASS. All images/audio are procedural; no backend or external resource paths.
- Vite base /STARFALL-VOID-FRONTIER/. Existing workflow retained: tests/build/asset checks/Chromium/WebKit/mobile before Pages deployment.
- Public URL: https://epictouch22.github.io/STARFALL-VOID-FRONTIER/.

## IMPORTANT ARCHITECTURE

- Canvas world + DOM UI, plain JSON state, bounded render caches/input outside saves. Save 6 keeps starfall-save-v1-* keys. Preserve seeded IDs and accepted legacy contract terms.
- core/docking.ts owns gate/pressure/capture state; world/stations.ts supplies shared floors; core/residents.ts owns actor motion/memory and physical servicing. UI dispatches, simulation works, renderer reads.
- Production acceptance needs preview at port 4173 or GAME_URL. scripts/live-check.mjs compares deployed JS/CSS against dist and opens New Game/all 14 panels in Chromium/WebKit.
