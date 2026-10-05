import type { State } from "./types";
import { encounterDefinitions, type EncounterKind } from "../data/encounters";
import { addItem, consume, log, quantity, remember } from "./state";
import { generateGalaxy } from "../world/galaxy";
export type Encounter = {
  id: string;
  kind: EncounterKind;
  system: number;
  x: number;
  y: number;
  started: number;
  resolved: number | null;
  choice: string;
  result: string;
};
export const pendingEncounters = (s: State) =>
  s.encounters.filter((e) => e.resolved === null);
export function beginEncounter(s: State, kind: EncounterKind) {
  const id = `${kind}:${s.system}`;
  if (s.encounters.some((e) => e.id === id)) return false;
  const contactKind =
    kind === "sos" ? "derelict" : kind === "beacon" ? "anomaly" : "station";
  const source = generateGalaxy(s.seed)[s.system].contacts.find(
    (c) => c.kind === contactKind,
  )!;
  s.encounters.push({
    id,
    kind,
    system: s.system,
    x: source.x,
    y: source.y,
    started: s.time,
    resolved: null,
    choice: "",
    result: "",
  });
  log(
    s,
    `${encounterDefinitions[kind].title}. Откройте «Сигналы» в журнале; решение можно отложить.`,
  );
  return true;
}
export function choiceUnavailable(
  s: State,
  e: Encounter,
  choiceId: string,
): string {
  const c = encounterDefinitions[e.kind].choices.find((c) => c.id === choiceId);
  if (!c || e.resolved !== null) return "Сигнал уже закрыт";
  if (s.system !== e.system) return "Вернитесь в систему сигнала";
  if (!["space", "station", "interior"].includes(s.mode))
    return "Вернитесь на корабль";
  if (c.pursuit && s.mode !== "space") return "Сначала отстыкуйтесь";
  if (
    !c.remote &&
    (s.mode !== "space" || Math.hypot(e.x - s.x, e.y - s.y) > 300)
  )
    return "Подойдите к сигналу на 300 м в космосе";
  if (s.credits < (c.credits ?? 0)) return "Недостаточно кредитов";
  if (s.ship.fuel < (c.fuel ?? 0)) return "Недостаточно топлива";
  if (s.ship.energy < (c.energy ?? 0))
    return "Подождите восстановления энергии";
  if (c.hullDamage && s.ship.hull <= c.hullDamage)
    return "Корпус не выдержит прорыва: нужен ремонт";
  if (c.pursuit && s.enemies.length >= 20)
    return "Слишком много противников: сначала завершите бой";
  if (Object.entries(c.cost ?? {}).some(([id, n]) => quantity(s, id) < n))
    return "Недостаточно припасов";
  // Check the entire transaction, including manifests, without touching the live state.
  const trial = { ...s, inventory: { ...s.inventory }, pack: { ...s.pack } };
  for (const [id, n] of Object.entries(c.cost ?? {})) consume(trial, id, n);
  for (const [id, n] of Object.entries(c.reward ?? {}))
    if (!addItem(trial, id, n, false))
      return "Освободите грузовой отсек: награда не помещается";
  return "";
}
export function resolveEncounter(s: State, id: string, choiceId: string) {
  const e = s.encounters.find((e) => e.id === id);
  if (!e) return false;
  const reason = choiceUnavailable(s, e, choiceId);
  if (reason) {
    log(s, reason);
    return false;
  }
  const c = encounterDefinitions[e.kind].choices.find(
    (c) => c.id === choiceId,
  )!;
  for (const [item, n] of Object.entries(c.cost ?? {})) consume(s, item, n);
  for (const [item, n] of Object.entries(c.reward ?? {}))
    addItem(s, item, n, false);
  s.credits += (c.payment ?? 0) - (c.credits ?? 0);
  s.ship.fuel -= c.fuel ?? 0;
  s.ship.energy -= c.energy ?? 0;
  s.ship.hull -= c.hullDamage ?? 0;
  s.health.radiation += c.radiation ?? 0;
  for (const [faction, n] of Object.entries(c.reputation ?? {}))
    s.reputation[Number(faction)] = Math.max(
      -100,
      Math.min(100, s.reputation[Number(faction)] + n),
    );
  let route = "";
  if (c.route) {
    const target = Math.floor(e.system / 5) * 5 + 4;
    if (!s.discovered.includes(target)) s.discovered.push(target);
    route = ` Открыт маршрут: ${generateGalaxy(s.seed)[target].name}.`;
  }
  if (c.pursuit) {
    const hp = 80 + Math.floor(s.system / 5) * 25;
    s.enemies.push({
      id: `patrol:${e.id}`,
      name: "Таможенный перехватчик",
      x: s.x + 550,
      y: s.y + 160,
      vx: 0,
      vy: 0,
      angle: 0,
      hp,
      maxHp: hp,
      shield: 15,
      cooldown: 2,
      kind: "mercenary",
      phase: 0,
      disabled: 0,
      boss: false,
    });
  }
  e.choice = c.id;
  e.resolved = s.time;
  e.result = `${encounterDefinitions[e.kind].title}: ${c.title}. ${c.description}${route}`;
  s.codex.push(e.result);
  log(s, e.result);
  remember(s, e.result);
  return true;
}
