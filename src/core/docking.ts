import type { State, MissionPort } from "./types";
import { stationContact } from "../world/stations";
import { log, remember } from "./state";
export type Docking = {
  port: MissionPort | null;
  phase: "none" | "requested" | "sealing" | "equalizing" | "ready";
  timer: number;
  pressure: number;
  shipDoor: boolean;
  stationDoor: boolean;
};
export const emptyDock = (): Docking => ({
  port: null,
  phase: "none",
  timer: 0,
  pressure: 0,
  shipDoor: false,
  stationDoor: false,
});
export function berth(s: State) {
  const c = s.docking.port && stationContact(s.seed, s.docking.port.location);
  return c ? { x: c.x + c.radius + 48, y: c.y, angle: Math.PI } : null;
}
export function requestDock(s: State, id: string) {
  const c = stationContact(s.seed, id);
  if (
    s.mode !== "space" ||
    !c ||
    !s.scanned.includes(id) ||
    Number(id.split("-")[0]) !== s.system ||
    Math.hypot(s.x - c.x, s.y - c.y) > 1800
  ) {
    log(s, "Порт не отвечает: нужен опознанный контакт в пределах 1800 м.");
    return false;
  }
  if (s.reputation[c.faction] < -60) {
    log(s, "Порт отказывает в доступе из-за репутации.");
    return false;
  }
  if (s.docking.phase !== "none" && s.docking.port?.location !== id) {
    log(s, "Сначала освободите текущий порт.");
    return false;
  }
  if (s.docking.phase === "none") {
    s.docking = emptyDock();
    s.docking.port = { system: s.system, location: id };
    s.docking.phase = "requested";
    remember(s, `Запрошен причал: ${c.name}.`);
  }
  log(
    s,
    `${c.name}: «Разрешение получено. Восточный причал; нос налево, скорость <12 м/с, расстояние до захватов ≤22 м».`,
  );
  return true;
}
export function captureDock(s: State, id: string) {
  const d = s.docking,
    point = berth(s);
  if (d.port?.location !== id || d.phase === "none") {
    log(s, "Сначала запросите разрешение через связь на карте.");
    return false;
  }
  if (d.phase !== "requested" || !point) {
    log(
      s,
      d.phase === "ready"
        ? "Герметизация завершена. Встаньте из кресла и идите к шлюзу."
        : "Захваты удерживают судно. Дождитесь герметизации и выравнивания давления.",
    );
    return false;
  }
  const range = Math.hypot(s.x - point.x, s.y - point.y),
    speed = Math.hypot(s.vx, s.vy),
    angle = Math.abs(
      Math.atan2(
        Math.sin(s.angle - point.angle),
        Math.cos(s.angle - point.angle),
      ),
    );
  if (range > 22 || speed >= 12 || angle > 0.18) {
    if (range <= 22 && (speed >= 12 || angle > 0.18)) {
      s.ship.hull = Math.max(1, s.ship.hull - 4);
      remember(s, "Неудачный захват: удар о причал повредил корпус на 4.");
    }
    log(
      s,
      `Нет захвата: ${Math.round(range)} м / ${speed.toFixed(1)} м/с / ошибка ${Math.round((angle * 180) / Math.PI)}°. Подлетите и выровняйте судно.`,
    );
    return false;
  }
  d.phase = "sealing";
  d.timer = 4;
  s.vx = 0;
  s.vy = 0;
  s.orbit = { x: s.x, y: s.y, angle: s.angle, active: true };
  log(s, "Магнитные захваты замкнуты. Герметизация тоннеля: 4 с.");
  remember(s, `Физический захват причала ${id}.`);
  return true;
}
export function tickDocking(s: State, dt: number) {
  const d = s.docking;
  if (d.phase !== "sealing" && d.phase !== "equalizing") return;
  d.timer = Math.max(0, d.timer - dt);
  if (d.phase === "equalizing") d.pressure = Math.min(1, 1 - d.timer / 4);
  if (d.timer > 0) return;
  if (d.phase === "sealing") {
    d.phase = "equalizing";
    d.timer = 4;
    log(s, "Тоннель герметичен. Давление выравнивается: 4 с.");
  } else {
    d.phase = "ready";
    d.pressure = 1;
    s.docked = true;
    log(
      s,
      "Давление выровнено. Встаньте из кресла, откройте корабельный шлюз и пройдите на станцию.",
    );
    remember(s, `Причал ${d.port?.location}: герметизация завершена.`);
  }
}
export function releaseDock(s: State) {
  if (s.maintenance) {
    log(s, "Дождитесь окончания ремонта и возвращения инженера на станцию.");
    return false;
  }
  if (
    s.mode !== "space" ||
    s.docking.phase !== "ready" ||
    s.docking.shipDoor ||
    s.docking.stationDoor
  ) {
    log(s, "Отстыковка требует закрытых дверей и управления из кабины.");
    return false;
  }
  remember(s, `Отстыковка от ${s.docking.port?.location}.`);
  s.docking = emptyDock();
  log(s, "Захваты отпущены. Двигатель свободен.");
  return true;
}
