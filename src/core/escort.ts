import type { State, MissionPort } from "./types";
import { generateGalaxy } from "../world/galaxy";
import { log } from "./state";
export type EscortShip = {
  system: number;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  arrived: boolean;
  ambushTriggered: boolean;
};
export function advanceEscort(
  s: State,
  ship: EscortShip,
  destination: MissionPort,
  dt: number,
) {
  if (
    ship.arrived ||
    ship.hull <= 0 ||
    ship.system !== s.system ||
    !["space", "station"].includes(s.mode)
  )
    return false;
  const port = generateGalaxy(s.seed)[destination.system].contacts.find(
    (c) => c.id === destination.location,
  )!;
  const dock = generateGalaxy(s.seed)[s.system].contacts.find(
    (c) => c.id === s.location,
  );
  const goal =
    s.mode === "station" && dock
      ? { x: dock.x + dock.radius + 70, y: dock.y }
      : s;
  const dx = goal.x - ship.x,
    dy = goal.y - ship.y,
    distance = Math.hypot(dx, dy);
  if (distance > 75) {
    ship.angle = Math.atan2(dy, dx);
    const step = Math.min(distance - 75, 195 * dt);
    ship.x += (dx / distance) * step;
    ship.y += (dy / distance) * step;
  }
  if (
    ship.system === destination.system &&
    Math.hypot(ship.x - port.x, ship.y - port.y) < port.radius + 150
  ) {
    ship.arrived = true;
    return true;
  }
  return false;
}
export function escortInJumpRange(s: State, ship: EscortShip) {
  return (
    ship.arrived ||
    (ship.hull > 0 &&
      ship.system === s.system &&
      Math.hypot(ship.x - s.x, ship.y - s.y) <= 250)
  );
}
export function escorts(s: State) {
  return s.contracts.flatMap((q) =>
    q.type === "escort" && q.mission?.stage === "delivery" && q.mission.escort
      ? [{ contract: q, ship: q.mission.escort }]
      : [],
  );
}
export function tickEscorts(s: State, dt: number) {
  for (const { contract, ship } of escorts(s)) {
    if (advanceEscort(s, ship, contract.mission!.destination, dt)) {
      contract.progress = 1;
      log(
        s,
        "Конвой «Светляк» достиг безопасной зоны порта. Сдайте контракт на станции.",
      );
    }
  }
}
export function jumpEscorts(s: State, from: number) {
  for (const { contract, ship } of escorts(s)) {
    if (ship.arrived || ship.system !== from) continue;
    ship.system = s.system;
    ship.x = s.x - 90;
    ship.y = s.y + 60;
    if (s.system === contract.mission!.destination.system) {
      const first = !ship.ambushTriggered;
      ship.ambushTriggered = true;
      if (
        s.enemies.length < 20 &&
        !s.kills.includes(`escort:${contract.id}`) &&
        !s.enemies.some((e) => e.id === `escort:${contract.id}`)
      )
        s.enemies.push({
          id: `escort:${contract.id}`,
          name: "Охотник за конвоем",
          x: ship.x + 500,
          y: ship.y + 250,
          vx: 0,
          vy: 0,
          angle: 0,
          hp: 65 + Math.floor(s.system / 5) * 25,
          maxHp: 65 + Math.floor(s.system / 5) * 25,
          shield: 0,
          cooldown: 1.5,
          kind: "pirate",
          phase: 0,
          disabled: 0,
          boss: false,
        });
      if (first)
        log(s, "Засада на конвой! Защитите «Светляк» и доведите его до порта.");
    }
  }
}
export function hitEscort(s: State, ship: EscortShip, damage: number) {
  const active = escorts(s).find((e) => e.ship === ship);
  if (!active || ship.arrived || ship.system !== s.system) return false;
  ship.hull = Math.max(0, ship.hull - damage);
  if (ship.hull === 0) {
    active.contract.mission!.stage = "failed";
    s.reputation[active.contract.faction] = Math.max(
      -100,
      s.reputation[active.contract.faction] - 8,
    );
    log(s, "Конвой «Светляк» уничтожен. Контракт провален, репутация −8.");
  }
  return true;
}
