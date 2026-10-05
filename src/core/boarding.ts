import type { State } from "./types";
import { addItem, consume, log, shipStats } from "./state";
import { hash, random } from "../world/galaxy";
import { rescueCrew } from "./economy";
export function boardDerelict(s: State, id: string) {
  s.orbit = { x: s.x, y: s.y, angle: s.angle, active: true };
  s.mode = "derelict";
  s.location = id;
  s.x = 0;
  s.y = 230;
  s.vx = 0;
  s.vy = 0;
  s.projectiles = [];
  const rng = random(hash(s.seed + id));
  s.enemies = Array.from(
    { length: id.startsWith("board:") ? 3 : 1 + Math.floor(rng() * 2) },
    (_, i) => ({
      id: `${id}-crew-${i}`,
      name: id.startsWith("board:") ? "Пират" : "Сторожевой робот",
      x: i % 2 ? -120 : 120,
      y: -100 + i * 65,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 30 + Math.floor(s.system / 5) * 15,
      maxHp: 30 + Math.floor(s.system / 5) * 15,
      shield: 0,
      cooldown: 2,
      kind: "crew",
      phase: 0,
      disabled: 0,
      boss: false,
    }),
  ).filter((e) => !s.kills.includes(e.id));
  log(
    s,
    "Абордаж. На борту обнаружено движение. Огонь: пробел или правый стик. Терминал — в центре.",
  );
}
export function externalRepair(s: State) {
  if (s.mode !== "eva" || Math.hypot(s.x - s.orbit.x, s.y - s.orbit.y) > 100)
    return false;
  if (
    s.ship.hull >= shipStats(s).hull &&
    !s.ship.modules.some((m) => m.breach)
  ) {
    log(s, "Корпус уже герметичен и исправен.");
    return false;
  }
  if (!consume(s, "parts")) {
    log(s, "Нужен ремкомплект в грузовом отсеке.");
    return false;
  }
  s.ship.hull = Math.min(shipStats(s).hull, s.ship.hull + 35);
  const damaged = s.ship.modules.find((m) => m.breach);
  if (damaged) {
    damaged.breach = false;
    damaged.integrity = Math.min(100, damaged.integrity + 30);
  }
  log(s, "Наружный ремонт завершён. Пробоина загерметизирована.");
  return true;
}
export function salvageBoard(s: State) {
  if (s.mode !== "derelict" || Math.hypot(s.x, s.y) > 100) return false;
  if (s.enemies.length) {
    log(s, "Сначала нейтрализуйте охрану терминала.");
    return false;
  }
  const rescued = rescueCrew(s);
  const key = s.location + "-salvaged";
  if (s.depleted[key]) {
    if (!rescued) log(s, "Груз уже извлечён.");
    return rescued;
  }
  if (!addItem(s, "exo", 2)) {
    if (!rescued) log(s, "Освободите место в контейнере скафандра.");
    return rescued;
  }
  addItem(s, "parts", 3);
  s.credits += 200;
  s.depleted[key] = 1;
  if (!rescued) log(s, "Бортовой журнал и груз спасены. +200 кредитов.");
  return true;
}
