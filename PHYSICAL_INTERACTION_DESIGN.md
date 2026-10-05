# Physical interaction design

E / contextual touch acts on the nearest accessible object. Walking/flight are simulated; menus never count as travel. Objects have identity, position, mode and an interaction radius. Work takes simulation time, cancels if the player leaves or changes location, and spends materials only when completion is possible. Opening a terminal or talking can open a panel after reaching it.

Docking: hail a discovered port → permission/assigned berth → approach under flight physics → relative speed and alignment check → magnetic capture → sealing and pressure equalization → leave cockpit → walk to ship airlock → traverse tunnel → station door. The ship retains its docking coordinates. Leaving reverses traversal; opening an airlock is distinct from undocking.

Stations use seeded connected rooms, corridors and identifiable facilities. Market, doctor, contracts and engineering require physical proximity. Interior geometry constrains movement; floor/walls/doors and markers must agree with the collision map. PC and iPhone share the same rules.

Implemented: explicit door states and blocked traversal, timed clinic/welding work, paid physical engineer with saved partial work. Future: gases by compartment, equippable tools, physical world cargo. Current ship oxygen/fire/breach is a coarser shared model.
