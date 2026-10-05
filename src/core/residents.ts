import type { State } from "./types";
import { hash, random } from "../world/galaxy";
import { stationLayout, type Facility } from "../world/stations";
import { log, remember, shipStats } from "./state";
export type Resident = {
  id: string;
  port: string;
  name: string;
  age: number;
  role: Exclude<Facility, "habitation">;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  opinion: number;
  met: boolean;
  memories: string[];
};
const roles: Resident["role"][] = [
  "trade",
  "contracts",
  "medical",
  "tech",
  "bar",
];
const lore: Record<Resident["role"], string> = {
  trade:
    "[Мира / мнение] Helix строит хорошие реакторы. И такие договоры, что за реактор расплачивается ещё твоя внучка. Здесь люди меняют деньги на воздух — не путай цену с ценностью.",
  contracts:
    "[Гильдия / закон] Void Maritime Convention защищает SOS и право спасения. Найти живого владельца на якобы покинутом корабле — значит пересмотреть право на salvage. Подпись на контракте не отменяет человеческую жизнь.",
  medical:
    "[Врач / наблюдение] В Пределе встречается Glass Syndrome: микрокристаллы под кожей. Мы не знаем причины. Last Light называет это пробуждением; для меня боль пациента — факт, а объяснение пока гипотеза.",
  tech: "[Инженер / традиция] First Bolt — первый заводской болт заменяют своим. Корабль становится домом. Не ставь его имя на уничтоженное судно: суеверие, но экипажу спокойнее.",
  bar: "[СЛУХ / Calypso] Говорят, в 2472-м исчезли 3 421 человека. Реактор работал. Официально — FTL-авария. А скраппер клялся, что терминал писал WELCOME BACK. Я не видел станцию; не принимай мои слова за доказательство.",
};
export function ensureResidents(s: State, port = s.location) {
  if (s.residents.some((n) => n.port === port)) return;
  const layout = stationLayout(s.seed, port),
    rng = random(hash(`${s.seed}:${port}:people`));
  const first = [
    "Мира",
    "Илья",
    "Сана",
    "Тарек",
    "Лин",
    "Ада",
    "Рен",
    "Мара",
    "Лазарь",
    "Нора",
  ];
  const last = [
    "Вей",
    "Рук",
    "Соль",
    "Нокс",
    "Келл",
    "Сато",
    "Ортис",
    "Морроу",
    "Лейн",
    "Восс",
  ];
  const home = layout.rooms.find((r) => r.id === "habitation")!;
  for (const [i, role] of roles.entries()) {
    const room = layout.rooms.find((r) => r.id === role)!;
    s.residents.push({
      id: `${port}:${role}`,
      port,
      role,
      name: `${first[Math.floor(rng() * first.length)]} ${last[Math.floor(rng() * last.length)]}`,
      age: 26 + Math.floor(rng() * 36),
      x: room.x,
      y: room.y,
      homeX: home.x + (i - 2) * 28,
      homeY: home.y,
      opinion: 0,
      met: false,
      memories: [],
    });
  }
}
export const activeResidents = (s: State) =>
  s.residents.filter((n) => n.port === s.location);
export function serviceAvailable(s: State, role: Resident["role"]) {
  return (
    s.mode === "station" &&
    (!s.physical ||
      activeResidents(s).some(
        (n) => n.role === role && Math.hypot(n.x - s.x, n.y - s.y) <= 70,
      ))
  );
}
export function tickResidents(s: State, dt: number) {
  if (!s.physical || (s.mode !== "station" && !s.maintenance)) return;
  const port = s.mode === "station" ? s.location : s.maintenance!.port;
  ensureResidents(s, port);
  const rooms = stationLayout(s.seed, port).rooms;
  for (const n of s.residents.filter((n) => n.port === port)) {
    const hour = Math.floor(s.time / 50) % 24;
    const resting = n.role === "bar" ? hour >= 8 && hour < 16 : hour >= 18;
    const work = rooms.find((r) => r.id === n.role)!;
    // An active conversation keeps its interlocutor present; menus already pause time.
    const order = s.maintenance?.worker === n.id ? s.maintenance : null;
    const module =
      order &&
      s.ship.modules[
        Math.min(s.ship.modules.length - 1, Math.floor(order.progress / 4))
      ];
    const target = order
      ? order.phase === "returning"
        ? work
        : module!
      : resting
        ? { x: n.homeX, y: n.homeY }
        : { x: work.x, y: work.y };
    let x = target.x,
      y = target.y;
    if (Math.abs(n.y - target.y) > 4) {
      if (Math.abs(n.x) > 4) {
        x = 0;
        y = n.y;
      } else x = 0;
    }
    const d = Math.hypot(x - n.x, y - n.y),
      step = Math.min(d, dt * 55);
    if (d > 0) {
      const nx = n.x + ((x - n.x) / d) * step,
        ny = n.y + ((y - n.y) / d) * step;
      const blocked =
        (!s.docking.stationDoor &&
          ((n.y < 480 && ny >= 462) || (n.y > 480 && ny <= 498))) ||
        (!s.docking.shipDoor &&
          ((n.y < 300 && ny >= 290) || (n.y > 300 && ny <= 310)));
      if (!blocked) {
        n.x = nx;
        n.y = ny;
      }
    }
    if (order && Math.hypot(n.x - target.x, n.y - target.y) < 18) {
      if (order.phase === "returning") {
        remember(s, `${n.name} завершил обслуживание и вернулся на станцию.`);
        log(s, "Инженер вернулся на станцию. Отстыковка разрешена.");
        s.maintenance = null;
      } else {
        order.phase = "working";
        order.progress = Math.min(order.duration, order.progress + dt);
        module!.integrity = Math.min(100, module!.integrity + dt * 25);
        module!.fire = Math.max(0, module!.fire - dt * 25);
        if (module!.integrity >= 99) module!.breach = false;
        const stats = shipStats(s);
        s.ship.hull = Math.min(
          stats.hull,
          s.ship.hull + (stats.hull * dt) / order.duration,
        );
        s.ship.shield = Math.min(
          stats.shield,
          s.ship.shield + (stats.shield * dt) / order.duration,
        );
        s.ship.fuel = Math.min(100, s.ship.fuel + (100 * dt) / order.duration);
        if (order.progress >= order.duration) {
          s.ship.ammo += 60;
          order.phase = "returning";
          log(s, `${n.name}: ремонт завершён. Возвращаюсь через тоннель.`);
        }
      }
    } else if (order && order.phase !== "returning") order.phase = "walking";
  }
}
export function talkResident(s: State, id: string, askLore = false) {
  const n = activeResidents(s).find((n) => n.id === id);
  if (!n || Math.hypot(n.x - s.x, n.y - s.y) > 70) return false;
  if (!n.met) {
    n.met = true;
    n.memories.push(
      `День ${1 + Math.floor(s.time / 1200)}: встретил капитана ${s.name}`,
    );
    remember(s, `Вы познакомились: ${n.name}.`);
  }
  if (askLore) {
    const text = lore[n.role].replace(
      /\[(?:Мира|Врач|Инженер|Гильдия)/,
      `[${n.name}`,
    );
    log(s, text);
    if (!s.codex.includes(text)) s.codex.push(text);
    if (!n.memories.includes("Обсуждали жизнь Предела")) {
      n.memories.push("Обсуждали жизнь Предела");
      n.opinion = Math.min(100, n.opinion + 2);
      remember(s, `${n.name}: ${text}`);
    }
  } else
    log(
      s,
      `${n.name}: «Капитан ${s.name}, ${n.met ? "рад видеть вас" : "добро пожаловать"}. Что нужно?»`,
    );
  return true;
}
