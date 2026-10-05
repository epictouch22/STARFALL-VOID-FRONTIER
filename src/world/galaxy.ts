import { biomes, regions } from "../data/catalog";
export const hash = (s: string) => {
  let n = 2166136261;
  for (const c of s) {
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  }
  return n >>> 0;
};
export function random(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Contact = {
  id: string;
  kind: "planet" | "station" | "outpost" | "derelict" | "anomaly" | "asteroid";
  name: string;
  x: number;
  y: number;
  radius: number;
  biome: number;
  faction: number;
  resource: string;
};
export type System = {
  id: number;
  name: string;
  region: number;
  x: number;
  y: number;
  color: string;
  contacts: Contact[];
  secret: boolean;
};
const galaxyCache = new Map<string, System[]>();
export function generateGalaxy(seed: string): System[] {
  const cached = galaxyCache.get(seed);
  if (cached) return cached;
  const rng = random(hash(seed));
  const names = [
    "Эос",
    "Тау",
    "Вега",
    "Нери",
    "Лира",
    "Орион",
    "Сириус",
    "Кай",
    "Арго",
    "Мира",
    "Ирис",
    "Зенит",
    "Нокс",
    "Соль",
    "Эхо",
    "Немезис",
    "Гидра",
    "Кронос",
    "Тень",
    "Астрея",
    "Хор",
    "Умбра",
    "Омега",
    "Бездна",
    "Арка",
  ];
  const result = names.map((name, id) => {
    const region = Math.floor(id / 5),
      contacts: Contact[] = [];
    const count = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < count; p++) {
      const angle = (p * Math.PI * 2) / count + 0.7,
        d = 600 + p * 250;
      let biome = Math.floor(rng() * biomes.length);
      if (id === 0 && p === 0) biome = 4;
      contacts.push({
        id: `${id}-p${p}`,
        kind: "planet",
        name: `${name} ${["I", "II", "III", "IV", "V"][p]}`,
        x: Math.cos(angle) * d,
        y: Math.sin(angle) * d,
        radius: 90 + rng() * 45,
        biome,
        faction: 2,
        resource: biomes[biome].resources[0],
      });
    }
    contacts.push({
      id: `${id}-s`,
      kind: "station",
      name: `Порт ${name}`,
      x: 300,
      y: -120,
      radius: 55,
      biome: 0,
      faction: id % 3,
      resource: "iron",
    });
    if (id % 2 === 0)
      contacts.push({
        id: `${id}-o`,
        kind: "outpost",
        name: `Форпост ${id + 1}`,
        x: -700,
        y: 700,
        radius: 35,
        biome: 0,
        faction: id % 3,
        resource: "titanium",
      });
    for (const [k, kind] of [
      "derelict",
      "anomaly",
      "asteroid",
      "asteroid",
    ].entries()) {
      contacts.push({
        id: `${id}-c${k}`,
        kind: kind as Contact["kind"],
        name: [
          "Обломки «Пилигрима»",
          "Неизвестная аномалия",
          "Астероидное поле",
          "Ледяные обломки",
        ][k],
        x: (rng() - 0.5) * 2400,
        y: (rng() - 0.5) * 2400,
        radius: kind === "asteroid" ? 50 : 40,
        biome: 0,
        faction: 4,
        resource:
          k === 3
            ? "ice"
            : ["iron", "cobalt", "crystal", "titanium"][region % 4],
      });
    }
    return {
      id,
      name,
      region,
      x: region * 210 + 50 + rng() * 130,
      y: 80 + (id % 5) * 90 + rng() * 40,
      color: ["#eace9a", "#e6b6a2", "#9bcee0", "#bba5e0", "#cf84b1"][region],
      contacts,
      secret: id % 5 === 4,
    };
  });
  if (galaxyCache.size > 10) galaxyCache.clear();
  galaxyCache.set(seed, result);
  return result;
}
export type SurfaceNode = {
  id: string;
  kind: "ship" | "mineral" | "ruin" | "plant" | "cave" | "wreck";
  name: string;
  x: number;
  y: number;
  resource: string;
  amount: number;
};
export function generateSurface(seed: string, planet: Contact): SurfaceNode[] {
  const rng = random(hash(seed + planet.id));
  const b = biomes[planet.biome];
  return [
    {
      id: `${planet.id}-ship`,
      kind: "ship",
      name: "Посадочный модуль",
      x: 0,
      y: 0,
      resource: "",
      amount: 0,
    },
    {
      id: `${planet.id}-ruin`,
      kind: "ruin",
      name: "Архив Хора",
      x: 320,
      y: -200,
      resource: "exo",
      amount: 3,
    },
    ...Array.from({ length: 35 }, (_, i) => ({
      id: `${planet.id}-n${i}`,
      kind: (i % 11 === 0
        ? "wreck"
        : i % 7 === 0
          ? "cave"
          : i % 5 === 0
            ? "plant"
            : "mineral") as SurfaceNode["kind"],
      name:
        i % 11 === 0
          ? "Разбитый корабль"
          : i % 7 === 0
            ? "Пещера"
            : i % 5 === 0
              ? "Флора"
              : "Месторождение",
      x: (rng() - 0.5) * 1800,
      y: (rng() - 0.5) * 1600,
      resource:
        i % 5 === 0
          ? "organic"
          : b.resources[Math.floor(rng() * b.resources.length)],
      amount: 3 + Math.floor(rng() * 6),
    })),
  ];
}
export const regionName = (system: System) => regions[system.region];
