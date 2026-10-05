import { items, recipes, upgrades, ships } from "../data/catalog";
import {
  addItem,
  consume,
  has,
  log,
  shipStats,
  quantity,
  weight,
} from "./state";
import type { State, Contract } from "./types";
import { generateGalaxy } from "../world/galaxy";
import { reservedCargo, inventorySlots } from "./inventory";
export function price(s: State, id: string, selling = false, faction = 0) {
  const base = items[id]?.price ?? 0;
  const local = 1 + Math.sin(s.system * 7 + id.length * 3) * 0.25;
  const rep = 1 + s.reputation[faction] * (selling ? 0.002 : -0.002);
  return Math.max(1, Math.round(base * local * rep * (selling ? 0.65 : 1)));
}
export function trade(
  s: State,
  id: string,
  n: number,
  selling: boolean,
  faction: number,
) {
  if (
    !items[id] ||
    s.mode !== "station" ||
    !Number.isInteger(faction) ||
    faction < 0 ||
    faction > 5 ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 1000
  )
    return false;
  const cost = price(s, id, selling, faction) * n;
  if (selling) {
    if (!consume(s, id, n)) return false;
    s.credits += cost;
  } else {
    if (s.credits < cost || !addItem(s, id, n)) return false;
    s.credits -= cost;
  }
  return true;
}
export function craft(s: State, id: string) {
  const r = recipes.find((x) => x.id === id);
  if (!r) return false;
  if (!has(s, "workbench") && s.mode !== "interior" && s.mode !== "station")
    return false;
  const needed = Object.entries(r.cost);
  if (needed.some(([k, n]) => quantity(s, k) < n)) return false;
  const copy = { ...s.inventory };
  const packCopy = { ...s.pack };
  needed.forEach(([k, n]) => consume(s, k, n));
  if (!addItem(s, id, r.amount)) {
    s.inventory = copy;
    s.pack = packCopy;
    return false;
  }
  log(s, `Создано: ${items[id].name} ×${r.amount}`);
  return true;
}
export function recycleItem(s: State, id: string) {
  if (!has(s, "recycle") || id === "iron" || !items[id] || !quantity(s, id))
    return false;
  const cargo = { ...s.inventory },
    pack = { ...s.pack };
  if (!consume(s, id)) return false;
  if (!addItem(s, "iron", 1)) {
    s.inventory = cargo;
    s.pack = pack;
    return false;
  }
  log(s, `Разобрано: ${items[id].name}. Получено железо ×1.`);
  return true;
}
export function buyUpgrade(s: State, id: string) {
  const u = upgrades.find((x) => x.id === id);
  if (
    !u ||
    s.upgrades.includes(id) ||
    s.credits < u.cost ||
    (u.requires && !s.upgrades.includes(u.requires)) ||
    (s.physical
      ? !s.discovered.some((id) => Math.floor(id / 5) >= u.region)
      : s.bosses.length < u.region) ||
    s.mode !== "station"
  )
    return false;
  s.credits -= u.cost;
  s.upgrades.push(id);
  if (u.effect === "hull") s.ship.hull += 70;
  if (u.effect === "shield") s.ship.shield = shipStats(s).shield;
  log(s, `Установлено: ${u.name}`);
  return true;
}
export function buyShip(s: State, id: string) {
  const ship = ships.find((x) => x.id === id);
  if (
    !ship ||
    s.mode !== "station" ||
    s.credits < ship.cost ||
    s.ship.class === id ||
    weight(s) > shipStats({ ...s, ship: { ...s.ship, class: id } }).cargo
  )
    return false;
  s.credits -= ship.cost;
  s.ship.class = id;
  s.ship.hull = shipStats(s).hull;
  s.ship.energy = shipStats(s).energy;
  const extra = [
    { id: "oxygen", name: "Кислородный модуль", x: -150, y: -150 },
    { id: "shield", name: "Генератор щита", x: 150, y: -150 },
    { id: "weapon", name: "Оружейный модуль", x: -150, y: 260 },
    { id: "quarters", name: "Жилой модуль", x: 150, y: 260 },
  ];
  s.ship.modules = s.ship.modules.filter(
    (m) => !["oxygen", "shield", "weapon", "quarters"].includes(m.id),
  );
  s.ship.modules.push(
    ...extra
      .slice(0, ship.rooms - 6)
      .map((m) => ({ ...m, integrity: 100, fire: 0, breach: false })),
  );
  log(s, `Вы купили ${ship.name}`);
  return true;
}
export function serviceShip(s: State) {
  if (s.mode !== "station" || s.credits < 180) return false;
  s.credits -= 180;
  const stats = shipStats(s);
  s.ship.hull = stats.hull;
  s.ship.shield = stats.shield;
  s.ship.fuel = 100;
  s.ship.energy = stats.energy;
  s.ship.ammo += 60;
  s.ship.modules.forEach((m) => {
    m.integrity = 100;
    m.fire = 0;
    m.breach = false;
  });
  log(s, "Корабль обслужен и заправлен");
  return true;
}
export function equipWeapon(s: State, id: string) {
  if (
    !["kinetic", "laser", "missile", "rail", "ion", "plasma", "mine"].includes(
      id,
    ) ||
    (id !== "kinetic" && !has(s, id))
  )
    return false;
  s.ship.weapon = id;
  return true;
}
export function contractOffers(s: State): Contract[] {
  const g = generateGalaxy(s.seed);
  const port = g[s.system].contacts.find(
    (c) => c.id === s.location && ["station", "outpost"].includes(c.kind),
  );
  const faction = port?.faction ?? s.system % 3;
  const origin = { system: s.system, location: port?.id ?? `${s.system}-s` };
  const destinationSystem = s.system % 5 < 4 ? s.system + 1 : s.system - 4;
  const destination = {
    system: destinationSystem,
    location: `${destinationSystem}-s`,
  };
  const base: Omit<
    Contract,
    "id" | "type" | "title" | "item" | "target" | "reward"
  > = { progress: 0, faction, complete: false, mission: null };
  const offers = [
    {
      id: `${s.system}-mining`,
      type: "mining",
      title: "Металл для колонии",
      item: "iron",
      target: 8,
      progress: 0,
      reward: 420,
      faction,
      complete: false,
      mission: null,
    },
    {
      id: `${s.system}-hunt`,
      type: "hunt",
      title: "Очистить торговый путь",
      item: "",
      target: 2,
      progress: 0,
      reward: 650,
      faction,
      complete: false,
      mission: null,
    },
    {
      id: `${s.system}-survey`,
      type: "survey",
      title: "Карта фронтира",
      item: "",
      target: 3,
      progress: 0,
      reward: 350,
      faction,
      complete: false,
      mission: null,
    },
    {
      id: `${s.system}-delivery`,
      type: "delivery",
      title: "Медицинская доставка",
      item: "",
      target: 2,
      progress: 0,
      reward: 450,
      faction,
      complete: false,
      mission: {
        origin,
        destination,
        pickup: null,
        stage: "delivery",
        manifest: { label: "Опечатанные медикаменты ×2", weight: 2, slots: 1 },
        escort: null,
      },
    },
    {
      id: `${s.system}-salvage`,
      type: "salvage",
      title: "Вернуть архивы",
      item: "exo",
      target: 2,
      progress: 0,
      reward: 600,
      faction,
      complete: false,
      mission: null,
    },
    {
      id: `${s.system}-repair`,
      type: "repair",
      title: "Ремкомплекты для порта",
      item: "parts",
      target: 4,
      progress: 0,
      reward: 320,
      faction,
      complete: false,
      mission: null,
    },
    {
      ...base,
      id: `${s.system}-passenger`,
      type: "passenger",
      title: "Перевезти экспедицию",
      item: "",
      target: 3,
      reward: 540,
      mission: {
        escort: null,
        origin,
        destination,
        pickup: null,
        stage: "delivery",
        manifest: {
          label: "Три геолога и их оборудование",
          weight: 12,
          slots: 2,
        },
      },
    },
    {
      ...base,
      id: `${s.system}-rescue`,
      type: "rescue",
      title: "Пропавший экипаж «Пилигрима»",
      item: "",
      target: 2,
      reward: 900,
      mission: {
        escort: null,
        origin,
        destination: origin,
        pickup: {
          system: destinationSystem,
          location: `${destinationSystem}-c0`,
        },
        stage: "pickup",
        manifest: {
          label: "Место для двух спасённых и оборудования",
          weight: 10,
          slots: 2,
        },
      },
    },
    {
      ...base,
      id: `${s.system}-escort`,
      type: "escort",
      title: "Охрана исследовательского конвоя",
      item: "",
      target: 1,
      reward: 780 + Math.floor(s.system / 5) * 150,
      mission: {
        origin,
        destination,
        pickup: null,
        stage: "delivery",
        manifest: {
          label: "Конвой «Светляк» — держитесь рядом",
          weight: 0,
          slots: 0,
        },
        escort: {
          system: s.system,
          x: (port?.x ?? 300) + (port?.radius ?? 55) + 100,
          y: port?.y ?? -120,
          angle: Math.PI,
          hull: 220,
          maxHull: 220,
          arrived: false,
          ambushTriggered: false,
        },
      },
    },
  ] satisfies Contract[];
  return offers;
}
export function missionTarget(q: Contract) {
  if (!q.mission || ["done", "cancelled", "failed"].includes(q.mission.stage))
    return null;
  return q.mission.stage === "pickup"
    ? q.mission.pickup
    : q.mission.destination;
}
export function destinationName(
  s: State,
  port: { system: number; location: string },
) {
  const sys = generateGalaxy(s.seed)[port.system];
  return `${sys.contacts.find((c) => c.id === port.location)?.name ?? port.location} / ${sys.name}`;
}
export function canAcceptContract(s: State, q: Contract) {
  if (
    q.type === "escort" &&
    s.contracts.some(
      (c) => c.type === "escort" && c.mission?.stage === "delivery",
    )
  )
    return false;
  if (
    s.mode !== "station" ||
    s.contracts.length >= 300 ||
    s.contracts.some((c) => c.id === q.id)
  )
    return false;
  if (!q.mission) return true;
  return (
    s.system === q.mission.origin.system &&
    s.location === q.mission.origin.location &&
    weight(s) + q.mission.manifest.weight <= shipStats(s).cargo &&
    inventorySlots(s.inventory) +
      reservedCargo(s).slots +
      q.mission.manifest.slots <=
      40
  );
}
export function acceptContract(s: State, id: string) {
  const q = contractOffers(s).find((q) => q.id === id);
  if (!q || !canAcceptContract(s, q)) return false;
  s.contracts.push(q);
  if (q.mission) {
    if (q.mission.stage === "delivery" && q.type !== "escort")
      q.progress = q.target;
    for (const port of [
      q.mission.origin,
      q.mission.destination,
      q.mission.pickup,
    ]) {
      if (!port) continue;
      if (!s.discovered.includes(port.system)) s.discovered.push(port.system);
      if (!s.scanned.includes(port.location)) s.scanned.push(port.location);
    }
  }
  log(
    s,
    `Контракт принят: ${q.title}${q.mission ? `. Маршрут: ${destinationName(s, missionTarget(q)!)}` : ""}`,
  );
  return true;
}
export function canClaimContract(s: State, q: Contract) {
  if (q.complete || s.mode !== "station") return false;
  if (q.mission)
    return (
      q.mission.stage === "delivery" &&
      (!q.mission.escort || q.mission.escort.arrived) &&
      s.system === q.mission.destination.system &&
      s.location === q.mission.destination.location
    );
  return q.item ? quantity(s, q.item) >= q.target : q.progress >= q.target;
}
export function cancelContract(s: State, id: string) {
  const q = s.contracts.find((q) => q.id === id);
  if (
    !q?.mission ||
    q.complete ||
    ["cancelled", "failed"].includes(q.mission.stage) ||
    s.mode !== "station"
  )
    return false;
  q.mission.stage = "cancelled";
  s.reputation[q.faction] = Math.max(-100, s.reputation[q.faction] - 4);
  log(
    s,
    `Контракт отменён: ${q.title}. Груз передан портовой службе, репутация −4.`,
  );
  return true;
}
export function rescueCrew(s: State) {
  if (s.mode !== "derelict" || s.enemies.length || Math.hypot(s.x, s.y) > 100)
    return false;
  let rescued = false;
  for (const q of s.contracts) {
    const m = q.mission;
    if (
      q.type !== "rescue" ||
      !m ||
      m.stage !== "pickup" ||
      m.pickup?.system !== s.system ||
      m.pickup.location !== s.location
    )
      continue;
    m.stage = "delivery";
    m.manifest.label = "Два спасённых члена экипажа и оборудование";
    q.progress = q.target;
    log(
      s,
      `Экипаж найден и эвакуирован. Верните людей: ${destinationName(s, m.destination)}.`,
    );
    rescued = true;
  }
  return rescued;
}
export function claimContract(s: State, id: string) {
  const q = s.contracts.find((q) => q.id === id);
  if (!q || !canClaimContract(s, q)) return false;
  if (q.mission) q.mission.stage = "done";
  else if (q.item) {
    if (!consume(s, q.item, q.target)) return false;
  } else if (q.progress < q.target) return false;
  q.complete = true;
  s.credits += q.reward;
  s.reputation[q.faction] = Math.min(100, s.reputation[q.faction] + 8);
  log(s, `Контракт выполнен: ${q.title}. +${q.reward} кредитов`);
  return true;
}
