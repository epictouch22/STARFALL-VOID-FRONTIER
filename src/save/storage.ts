import type { State, ContractMission, MissionPort } from "../core/types";
import { newGame } from "../core/state";
import { items, upgrades, ships } from "../data/catalog";
import { hash, generateGalaxy } from "../world/galaxy";
const key = (slot: number) => `starfall-save-v1-${slot}`;
export function validateState(value: unknown): value is State {
  try {
    return validate(value);
  } catch {
    return false;
  }
}
function validate(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State,
    template = newGame();
  if (Object.keys(template).some((k) => !(k in s)) || s.version !== 3)
    return false;
  const validNum = (n: unknown, min = 0, max = 1e9) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const str = (n: unknown, max = 500) =>
    typeof n === "string" && n.length <= max;
  const validPort = (p: MissionPort | null, kinds: string[]) =>
    !!p &&
    Number.isInteger(p.system) &&
    validNum(p.system, 0, 24) &&
    generateGalaxy(s.seed)[p.system].contacts.some(
      (c) => c.id === p.location && kinds.includes(c.kind),
    );
  const validMission = (
    m: ContractMission | null,
    complete: boolean,
    type: string,
  ) => {
    if (m === null) return !["passenger", "rescue"].includes(type);
    return (
      !!m &&
      ["delivery", "passenger", "rescue"].includes(type) &&
      validPort(m.origin, ["station", "outpost"]) &&
      validPort(m.destination, ["station", "outpost"]) &&
      (type === "rescue"
        ? validPort(m.pickup, ["derelict"])
        : m.pickup === null) &&
      ["pickup", "delivery", "done", "cancelled"].includes(m.stage) &&
      (m.stage !== "pickup" || type === "rescue") &&
      complete === (m.stage === "done") &&
      !!m.manifest &&
      str(m.manifest.label, 150) &&
      validNum(m.manifest.weight, 0.1, 1000) &&
      validNum(m.manifest.slots, 1, 40) &&
      Number.isInteger(m.manifest.slots)
    );
  };
  if (
    !s.pack ||
    typeof s.pack !== "object" ||
    Array.isArray(s.pack) ||
    Object.entries(s.pack).some(
      ([id, n]) => !items[id] || !validNum(n, 0, 1e6) || !Number.isInteger(n),
    )
  )
    return false;
  if (
    !Array.isArray(s.quickSlots) ||
    s.quickSlots.length !== 4 ||
    s.quickSlots.some((id) => !items[id] || items[id].kind === "resource")
  )
    return false;
  if (
    !s.avatar ||
    ![s.avatar.skin, s.avatar.suit, s.avatar.hair].every(
      (color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color),
    ) ||
    !validNum(s.avatar.style, 0, 2) ||
    !Number.isInteger(s.avatar.style) ||
    typeof s.avatar.helmet !== "boolean"
  )
    return false;
  if (
    !s.orbit ||
    ![s.orbit.x, s.orbit.y, s.orbit.angle].every((n) =>
      validNum(n, -10000, 10000),
    ) ||
    typeof s.orbit.active !== "boolean"
  )
    return false;
  if (
    !str(s.seed, 80) ||
    !str(s.name, 40) ||
    !str(s.location, 100) ||
    !["interior", "space", "surface", "station", "eva", "derelict"].includes(
      s.mode,
    ) ||
    !validNum(s.system, 0, 24) ||
    !Number.isInteger(s.system) ||
    !validNum(s.slot, 0, 2) ||
    !Number.isInteger(s.slot)
  )
    return false;
  if (
    ![s.x, s.y, s.vx, s.vy, s.angle].every((n) => validNum(n, -10000, 10000)) ||
    ![
      s.credits,
      s.time,
      s.eventClock,
      s.eventIndex,
      s.intro,
      s.chapter,
      s.cooldown,
    ].every((n) => validNum(n))
  )
    return false;
  if (
    s.chapter > 5 ||
    s.intro > 4 ||
    !s.inventory ||
    typeof s.inventory !== "object" ||
    Array.isArray(s.inventory) ||
    Object.entries(s.inventory).some(
      ([k, n]) => !items[k] || !validNum(n, 0, 1e6) || !Number.isInteger(n),
    )
  )
    return false;
  if (
    !s.ship ||
    !ships.some((x) => x.id === s.ship.class) ||
    !str(s.ship.name, 40) ||
    !/^#[0-9a-f]{6}$/i.test(s.ship.color) ||
    !/^#[0-9a-f]{6}$/i.test(s.ship.accent) ||
    !["kinetic", "laser", "missile", "rail", "ion", "plasma", "mine"].includes(
      s.ship.weapon,
    )
  )
    return false;
  if (
    ![
      s.ship.hull,
      s.ship.shield,
      s.ship.energy,
      s.ship.fuel,
      s.ship.ammo,
      s.ship.heat,
    ].every((n) => validNum(n))
  )
    return false;
  if (
    !Array.isArray(s.ship.modules) ||
    s.ship.modules.length < 6 ||
    s.ship.modules.length > 10 ||
    new Set(s.ship.modules.map((m) => m.id)).size !== s.ship.modules.length ||
    !template.ship.modules.every((m) =>
      s.ship.modules.some((x) => x.id === m.id),
    ) ||
    s.ship.modules.some(
      (m) =>
        ![m.integrity, m.fire].every((n) => validNum(n, 0, 100)) ||
        typeof m.breach !== "boolean" ||
        !validNum(m.x, -300, 300) ||
        !validNum(m.y, -300, 300) ||
        !str(m.name, 80),
    )
  )
    return false;
  if (
    !s.health ||
    !Array.isArray(s.health.parts) ||
    s.health.parts.length !== 6 ||
    s.health.parts.some(
      (p) =>
        !str(p.name, 40) ||
        !validNum(p.health, 0, 100) ||
        !p.wounds ||
        Object.entries(p.wounds).some(
          ([k, n]) =>
            ![
              "cut",
              "burn",
              "fracture",
              "cold",
              "toxin",
              "radiation",
              "puncture",
              "bruise",
              "suffocation",
            ].includes(k) || !validNum(n),
        ),
    )
  )
    return false;
  if (
    ![
      s.health.blood,
      s.health.oxygen,
      s.health.pain,
      s.health.radiation,
      s.health.temperature,
      s.health.consciousness,
      s.health.hunger,
    ].every((n) => validNum(n, -100, 1000))
  )
    return false;
  if (!validNum(s.health.stimulant, 0, 60)) return false;
  for (const field of ["discovered", "bosses", "evidence"] as const)
    if (
      !Array.isArray(s[field]) ||
      s[field].length > 100 ||
      s[field].some((n) => !validNum(n, 0, 24) || !Number.isInteger(n))
    )
      return false;
  for (const field of [
    "scanned",
    "upgrades",
    "kills",
    "codex",
    "logs",
  ] as const)
    if (
      !Array.isArray(s[field]) ||
      s[field].length > 10000 ||
      s[field].some((n) => !str(n, 1000))
    )
      return false;
  if (
    s.upgrades.some((id) => !upgrades.some((u) => u.id === id)) ||
    new Set(s.upgrades).size !== s.upgrades.length ||
    s.bosses.some((n) => n > 4) ||
    s.evidence.some((n) => n > 4)
  )
    return false;
  if (
    !Array.isArray(s.reputation) ||
    s.reputation.length !== 5 ||
    s.reputation.some((n) => !validNum(n, -100, 100))
  )
    return false;
  if (
    !s.depleted ||
    typeof s.depleted !== "object" ||
    Object.values(s.depleted).some((n) => !validNum(n))
  )
    return false;
  if (
    !Array.isArray(s.contracts) ||
    s.contracts.length > 300 ||
    new Set(s.contracts.map((q) => q.id)).size !== s.contracts.length ||
    s.contracts.some(
      (q) =>
        !str(q.id) ||
        !str(q.title) ||
        ![
          "mining",
          "hunt",
          "survey",
          "delivery",
          "salvage",
          "repair",
          "passenger",
          "rescue",
        ].includes(q.type) ||
        !str(q.item) ||
        (q.item !== "" && !items[q.item]) ||
        ![q.target, q.progress, q.reward].every((n) => validNum(n)) ||
        !validNum(q.faction, 0, 4) ||
        !Number.isInteger(q.faction) ||
        !validMission(q.mission, q.complete, q.type) ||
        typeof q.complete !== "boolean",
    )
  )
    return false;
  if (
    !s.settings ||
    ![s.settings.sfx, s.settings.music, s.settings.opacity].every((n) =>
      validNum(n, 0, 1),
    ) ||
    !validNum(s.settings.uiScale, 0.7, 1.5) ||
    !validNum(s.settings.stickSize, 70, 180) ||
    !validNum(s.settings.sensitivity, 0.5, 2) ||
    typeof s.settings.mute !== "boolean" ||
    typeof s.settings.reduced !== "boolean"
  )
    return false;
  if (
    !Array.isArray(s.enemies) ||
    s.enemies.length > 20 ||
    s.enemies.some(
      (e) =>
        !str(e.id) ||
        !str(e.name) ||
        !str(e.kind) ||
        ![e.x, e.y, e.vx, e.vy, e.angle, e.cooldown].every((n) =>
          validNum(n, -10000, 10000),
        ) ||
        ![e.hp, e.maxHp, e.shield, e.phase, e.disabled].every((n) =>
          validNum(n),
        ) ||
        typeof e.boss !== "boolean",
    )
  )
    return false;
  if (
    !Array.isArray(s.projectiles) ||
    s.projectiles.length > 201 ||
    s.projectiles.some(
      (p) =>
        ![p.x, p.y, p.vx, p.vy, p.life].every((n) =>
          validNum(n, -10000, 10000),
        ) ||
        !validNum(p.damage) ||
        !["player", "enemy"].includes(p.owner) ||
        !str(p.weapon),
    )
  )
    return false;
  return (
    s.stats &&
    [s.stats.mined, s.stats.kills, s.stats.jumps].every((n) => validNum(n)) &&
    typeof s.docked === "boolean" &&
    ["", "destroy", "control", "colonists"].includes(s.ending)
  );
}
export function encode(s: State) {
  const payload = JSON.stringify(s);
  return JSON.stringify({
    format: "STARFALL",
    saveVersion: s.version,
    checksum: hash(payload),
    payload,
  });
}
export function decode(raw: string): State {
  if (raw.length > 4e6) throw new Error("Файл слишком большой");
  const e = JSON.parse(raw);
  if (
    e.format !== "STARFALL" ||
    ![1, 2, 3].includes(e.saveVersion) ||
    typeof e.payload !== "string" ||
    hash(e.payload) !== e.checksum
  )
    throw new Error("Неверный формат или повреждённое сохранение");
  const rawState = JSON.parse(e.payload);
  if (!rawState || rawState.version !== e.saveVersion)
    throw new Error("Версии оболочки и данных не совпадают");
  const s = migrate(rawState);
  if (!validateState(s))
    throw new Error("Сохранение не прошло проверку данных");
  return s;
}
export function migrate(value: unknown): unknown {
  if (!value || typeof value !== "object")
    throw new Error("Некорректное сохранение");
  const old = value as Record<string, unknown>;
  if (old.version === 3) return old;
  if (old.version === 2)
    return {
      ...old,
      version: 3,
      health:
        old.health && typeof old.health === "object"
          ? { ...old.health, stimulant: 0 }
          : old.health,
      contracts: Array.isArray(old.contracts)
        ? old.contracts.map((q) => ({ ...q, mission: null }))
        : old.contracts,
    };
  if (old.version === 1) {
    const defaults = newGame();
    return migrate({
      ...old,
      version: 2,
      pack: {},
      quickSlots: defaults.quickSlots,
      avatar: defaults.avatar,
    });
  }
  throw new Error("Эта версия сохранения не поддерживается");
}
export function save(s: State) {
  if (!validateState(s))
    throw new Error(
      "Состояние не прошло проверку. Предыдущее сохранение сохранено.",
    );
  const previous = localStorage.getItem(key(s.slot));
  if (previous) {
    try {
      decode(previous);
      localStorage.setItem(key(s.slot) + "-backup", previous);
    } catch {
      /* Keep existing backup. */
    }
  }
  localStorage.setItem(key(s.slot), encode(s));
  localStorage.setItem(key(s.slot) + "-date", new Date().toISOString());
}
export function load(slot: number) {
  const raw = localStorage.getItem(key(slot));
  if (!raw) return null;
  try {
    return decode(raw);
  } catch {
    const backup = localStorage.getItem(key(slot) + "-backup");
    if (backup) return decode(backup);
    throw new Error("Слот повреждён. Импортируйте резервную копию.");
  }
}
export function slots() {
  return [0, 1, 2].map((slot) => {
    try {
      const s = load(slot);
      return {
        slot,
        state: s,
        date: localStorage.getItem(key(slot) + "-date"),
        error: "",
      };
    } catch (e) {
      return { slot, state: null, date: null, error: String(e) };
    }
  });
}
export function exportSave(s: State) {
  const blob = new Blob([encode(s)], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `starfall-slot-${s.slot + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
