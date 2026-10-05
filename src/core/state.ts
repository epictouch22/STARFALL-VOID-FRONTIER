import { ships, upgrades, items } from "../data/catalog";
import type { State, Health } from "./types";
import { inventoryWeight, inventorySlots, reservedCargo } from "./inventory";
export function healthy(): Health {
  return {
    parts: [
      "Голова",
      "Торс",
      "Левая рука",
      "Правая рука",
      "Левая нога",
      "Правая нога",
    ].map((name) => ({ name, health: 100, wounds: {} })),
    blood: 100,
    oxygen: 100,
    pain: 0,
    radiation: 0,
    temperature: 37,
    consciousness: 100,
    hunger: 100,
    stimulant: 0,
  };
}
export function newGame(seed = "STARFALL", slot = 0, name = "Пилот"): State {
  return {
    version: 5,
    encounters: [],
    physical: true,
    activity: null,
    chronicle: [],
    pack: { bandage: 2, oxygen: 1 },
    quickSlots: ["fuel", "oxygen", "food", "ammo"],
    avatar: {
      skin: "#d4ad91",
      suit: "#79dce2",
      hair: "#5b4239",
      style: 0,
      helmet: true,
    },
    orbit: { x: 0, y: 0, angle: -Math.PI / 2, active: false },
    seed,
    slot,
    name,
    mode: "interior",
    system: 0,
    location: "",
    x: 0,
    y: 125,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    credits: 650,
    inventory: {
      iron: 8,
      copper: 4,
      parts: 5,
      bandage: 4,
      medkit: 2,
      fuel: 3,
      oxygen: 3,
      food: 3,
      ammo: 3,
    },
    health: healthy(),
    ship: {
      class: "shuttle",
      name: "KESTREL",
      color: "#79dce2",
      accent: "#ffb66b",
      hull: 80,
      shield: 0,
      energy: 65,
      fuel: 85,
      ammo: 160,
      heat: 0,
      weapon: "kinetic",
      modules: [
        {
          id: "cockpit",
          name: "Кабина",
          x: 0,
          y: -150,
          integrity: 100,
          fire: 0,
          breach: false,
        },
        {
          id: "reactor",
          name: "Реактор",
          x: -150,
          y: 0,
          integrity: 45,
          fire: 0,
          breach: false,
        },
        {
          id: "engine",
          name: "Двигатель",
          x: 150,
          y: 0,
          integrity: 60,
          fire: 0,
          breach: false,
        },
        {
          id: "medbay",
          name: "Медотсек",
          x: -150,
          y: 150,
          integrity: 100,
          fire: 0,
          breach: false,
        },
        {
          id: "fabricator",
          name: "Верстак",
          x: 150,
          y: 150,
          integrity: 100,
          fire: 0,
          breach: false,
        },
        {
          id: "airlock",
          name: "Шлюз",
          x: 0,
          y: 260,
          integrity: 70,
          fire: 0,
          breach: true,
        },
      ],
    },
    discovered: [0, 1, 2],
    scanned: [],
    depleted: {},
    upgrades: [],
    reputation: [0, 0, 15, -15, -10, 0],
    contracts: [],
    kills: [],
    bosses: [],
    chapter: 0,
    evidence: [],
    intro: 0,
    docked: false,
    ending: "",
    codex: [],
    logs: [
      "Вы приходите в сознание. Воздух уходит через шлюз. Найдите инструменты у верстака.",
    ],
    time: 0,
    stats: { mined: 0, kills: 0, jumps: 0 },
    eventClock: 90,
    eventIndex: 0,
    settings: {
      mute: false,
      sfx: 0.3,
      music: 0.12,
      reduced: false,
      uiScale: 1,
      stickSize: 110,
      opacity: 0.65,
      sensitivity: 1,
    },
    enemies: [],
    projectiles: [],
    cooldown: 0,
  };
}
export const has = (s: State, effect: string) =>
  s.upgrades.some((id) => upgrades.find((u) => u.id === id)?.effect === effect);
export const count = (s: State, effect: string) =>
  s.upgrades.filter(
    (id) => upgrades.find((u) => u.id === id)?.effect === effect,
  ).length;
export function shipStats(s: State) {
  const base = ships.find((x) => x.id === s.ship.class) ?? ships[0];
  return {
    hull: base.hull + (has(s, "hull") ? 70 : 0),
    shield: has(s, "shield") ? 70 + (has(s, "phase") ? 60 : 0) : 0,
    speed: base.speed * (has(s, "speed") ? 1.3 : 1),
    energy: base.energy + (has(s, "energy") ? 70 : 0),
    cargo: base.cargo + count(s, "cargo") * 100,
    oxygen: has(s, "oxygen") ? 200 : 100,
  };
}
export function weight(s: State) {
  return inventoryWeight(s.inventory) + reservedCargo(s).weight;
}
export const quantity = (s: State, id: string) =>
  (s.inventory[id] ?? 0) + (s.pack[id] ?? 0);
export function addItem(
  s: State,
  id: string,
  n: number,
  toPack = ["surface", "eva", "derelict"].includes(s.mode),
) {
  if (!items[id] || !Number.isInteger(n) || n <= 0) return false;
  const pool = toPack ? s.pack : s.inventory;
  const next = { ...pool, [id]: (pool[id] ?? 0) + n };
  const reserved = toPack ? { weight: 0, slots: 0 } : reservedCargo(s);
  if (
    inventoryWeight(next) + reserved.weight >
      (toPack ? 35 : shipStats(s).cargo) ||
    inventorySlots(next) + reserved.slots > (toPack ? 12 : 40)
  )
    return false;
  pool[id] = (pool[id] ?? 0) + n;
  return true;
}
export function consume(s: State, id: string, n = 1) {
  if (!Number.isInteger(n) || n < 1 || quantity(s, id) < n) return false;
  for (const pool of [s.pack, s.inventory]) {
    const used = Math.min(pool[id] ?? 0, n);
    if (used) {
      pool[id] -= used;
      n -= used;
      if (!pool[id]) delete pool[id];
    }
    if (n === 0) break;
  }
  return true;
}
export function log(s: State, message: string) {
  s.logs.unshift(message);
  s.logs = s.logs.slice(0, 40);
}
export function legacyGame(seed = "STARFALL", slot = 0, name = "Пилот"): State {
  return { ...newGame(seed, slot, name), physical: false };
}
export function remember(s: State, text: string) {
  s.chronicle.push({ time: s.time, system: s.system, text });
  s.chronicle = s.chronicle.slice(-1000);
}
