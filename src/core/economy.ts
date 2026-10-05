import { items, recipes, upgrades, ships } from "../data/catalog";
import { addItem, consume, has, log, shipStats, quantity } from "./state";
import type { State, Contract } from "./types";
export function price(s: State, id: string, selling = false, faction = 0) {
  const base = items[id]?.price ?? 0;
  const local = 1 + Math.sin(s.system * 7 + id.length * 3) * 0.25;
  const rep = 1 - s.reputation[faction] * 0.002;
  return Math.max(1, Math.round(base * local * rep * (selling ? 0.65 : 1)));
}
export function trade(
  s: State,
  id: string,
  n: number,
  selling: boolean,
  faction: number,
) {
  if (s.mode !== "station" || !Number.isInteger(n) || n < 1 || n > 1000)
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
export function buyUpgrade(s: State, id: string) {
  const u = upgrades.find((x) => x.id === id);
  if (
    !u ||
    s.upgrades.includes(id) ||
    s.credits < u.cost ||
    (u.requires && !s.upgrades.includes(u.requires)) ||
    s.bosses.length < u.region ||
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
    s.ship.class === id
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
export function contractOffers(s: State): Contract[] {
  const faction = s.system % 3;
  return [
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
    },
    {
      id: `${s.system}-delivery`,
      type: "delivery",
      title: "Медицинская доставка",
      item: "medkit",
      target: 2,
      progress: 0,
      reward: 450,
      faction,
      complete: false,
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
    },
    {
      id: `${s.system}-repair`,
      type: "repair",
      title: "Восстановить экспедиционный корабль",
      item: "parts",
      target: 4,
      progress: 0,
      reward: 320,
      faction,
      complete: false,
    },
  ];
}
export function claimContract(s: State, id: string) {
  const q = s.contracts.find((q) => q.id === id);
  if (!q || q.complete || s.mode !== "station") return false;
  if (q.item) {
    if (!consume(s, q.item, q.target)) return false;
  } else if (q.progress < q.target) return false;
  q.complete = true;
  s.credits += q.reward;
  s.reputation[q.faction] = Math.min(100, s.reputation[q.faction] + 8);
  log(s, `Контракт выполнен: ${q.title}. +${q.reward} кредитов`);
  return true;
}
