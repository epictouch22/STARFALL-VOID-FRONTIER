# World simulation

Keep seeded geometry/IDs stable. Six canonical powers: Terran Commonwealth, Helix Dynamics, Free Frontier League, Blackwake, Last Light, Veil Institute. Existing reputation slots 0–4 map in that order; slot 5 is Institute, appended by migration. Independent settlements are local cultures, not a seventh universal government.

Active location: fixed-step actors, collisions, physical work, damage and movement. Distant locations: compact saved identities and significant mutations, eventually coarse economic/political ticks. Rendering caches and input are never serialized.

Station identity derives from seed, with stable founding dates, cultural type, local history and staff. Mutable NPC opinions/memories and economy must be separate from generated descriptions. A printed population does not itself implement demographic simulation.

World time advances only during active play; menus/background pause. Existing save keys and checksum envelope persist. Schema migrations explicitly initialize new fields without losing cargo, missions, injuries or endings. Validate nested state, bound event/history arrays and prevent double rewards after reload.

Not yet implemented by this design document: ownership wars, population change, production/stock, prisons, escape pods, insurance and remote full NPC simulation. See PROGRESS.md for actual implementation.
