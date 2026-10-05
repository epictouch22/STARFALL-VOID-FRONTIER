import { boardDerelict, externalRepair, salvageBoard } from "./boarding";
import { unloadResources } from "./inventory";
import { escorts, escortInJumpRange, jumpEscorts } from "./escort";
import { beginEncounter } from "./encounters";
import { biomes, chapters, events, items } from "../data/catalog";
import {
  generateGalaxy,
  generateSurface,
  hash,
  random,
  type Contact,
} from "../world/galaxy";
import {
  addItem,
  consume,
  has,
  healthy,
  log,
  shipStats,
  remember,
  quantity,
} from "./state";
import type { State, Enemy } from "./types";
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function contacts(s: State) {
  return generateGalaxy(s.seed)[s.system].contacts;
}
export function currentPlanet(s: State) {
  return contacts(s).find((c) => c.id === s.location && c.kind === "planet");
}
export function enterSpace(s: State) {
  s.mode = "space";
  s.x = s.orbit.active ? s.orbit.x : 0;
  s.y = s.orbit.active ? s.orbit.y : 0;
  s.angle = s.orbit.active ? s.orbit.angle : -Math.PI / 2;
  s.vx = 0;
  s.vy = 0;
  s.location = "";
  s.projectiles = [];
  if (!s.orbit.active) populateEnemies(s);
  s.orbit.active = true;
}
export function populateEnemies(s: State) {
  const rng = random(hash(s.seed + s.system + "enemies"));
  s.enemies = Array.from({ length: 1 + Math.floor(s.system / 5) }, (_, i) => ({
    id: `${s.system}-enemy-${i}`,
    name: ["Корсар", "Дрон", "Наёмник", "Культист", "Страж"][s.system % 5],
    x: 950 + rng() * 400,
    y: -500 + rng() * 1000,
    vx: 0,
    vy: 0,
    angle: 0,
    hp: 50 + Math.floor(s.system / 5) * 35,
    maxHp: 50 + Math.floor(s.system / 5) * 35,
    shield: Math.floor(s.system / 5) * 10,
    cooldown: 2,
    kind: ["pirate", "drone", "mercenary", "cult", "robot"][s.system % 5],
    phase: 0,
    disabled: 0,
    boss: false,
  })).filter((e) => !s.kills.includes(e.id));
}
export function nearest(s: State) {
  if (s.mode === "eva")
    return {
      id: "own-ship",
      name: "Наружный корпус",
      x: s.orbit.x,
      y: s.orbit.y,
    };
  if (s.mode === "space") {
    const disabled = s.enemies
      .filter((e) => !e.boss && e.hp < e.maxHp * 0.22 && distance(s, e) < 200)
      .sort((a, b) => distance(s, a) - distance(s, b))[0];
    if (disabled) return disabled;
  }
  if (s.mode === "derelict")
    return { id: "terminal", name: "Бортовой терминал", x: 0, y: 0 };
  if (s.mode === "interior")
    return s.ship.modules
      .slice()
      .sort((a, b) => distance(s, a) - distance(s, b))[0];
  if (s.mode === "station")
    return stationPoints
      .slice()
      .sort((a, b) => distance(s, a) - distance(s, b))[0];
  if (s.mode === "surface") {
    const p = currentPlanet(s);
    return p
      ? generateSurface(s.seed, p)
          .filter(
            (n) =>
              n.kind === "ship" ||
              (s.depleted[n.id] ?? 0) < n.amount ||
              n.kind === "ruin",
          )
          .sort((a, b) => distance(s, a) - distance(s, b))[0]
      : undefined;
  }
  return contacts(s)
    .slice()
    .sort((a, b) => distance(s, a) - a.radius - (distance(s, b) - b.radius))[0];
}
export const stationPoints = [
  { id: "dock", name: "Шлюз / отстыковка", x: 0, y: 260 },
  { id: "trade", name: "Рынок · Мира Вей", x: -150, y: 0 },
  { id: "contracts", name: "Контракты · Илья Нокс", x: 150, y: 0 },
  { id: "medical", name: "Медотсек · д-р Кай", x: -150, y: 150 },
  { id: "tech", name: "Верфь · Ада Соль", x: 150, y: 150 },
  { id: "bar", name: "Бар · архивариус Эхо", x: 0, y: -150 },
];
export function contextLabel(s: State) {
  if (s.activity)
    return `${s.activity.label} · ${Math.ceil(s.activity.duration - s.activity.elapsed)} с / отменить`;
  const n = nearest(s);
  if (!n) return "Сканировать";
  const d = distance(s, n);
  if (s.mode === "eva") return "Ремонт корпуса (1 ремкомплект)";
  if (s.mode === "space" && s.enemies.some((e) => e.id === n.id))
    return "Абордаж обездвиженного корабля";
  if (s.mode === "derelict") return "Обыскать терминал";
  if (s.mode === "interior")
    return s.intro === 0
      ? "Найти инструменты у верстака"
      : n.id === "cockpit"
        ? "Сесть за штурвал"
        : n.id === "airlock" && s.intro >= 4
          ? "Выход в открытый космос"
          : `Осмотреть: ${n.name}`;
  if (s.mode === "station") return n.name;
  if (s.mode === "surface")
    return d < 85 ? `Взаимодействовать: ${n.name}` : `Подойти: ${n.name}`;
  const c = n as Contact;
  return d < c.radius + 115
    ? c.kind === "planet"
      ? "Посадка"
      : c.kind === "station" || c.kind === "outpost"
        ? "Стыковка"
        : c.kind === "derelict"
          ? "Абордаж"
          : c.kind === "asteroid"
            ? "Добыть ресурс"
            : "Исследовать аномалию"
    : "Приблизиться к контакту";
}
export function scan(s: State) {
  const radius = has(s, "scout") ? 10000 : has(s, "scan") ? 2500 : 1400;
  let count = 0;
  for (const c of contacts(s)) {
    if (distance(s, c) < radius && !s.scanned.includes(c.id)) {
      s.scanned.push(c.id);
      count++;
      s.codex.push(
        `${c.name}: ${c.kind === "planet" ? biomes[c.biome].name + " · " + biomes[c.biome].atmosphere : c.kind}`,
      );
    }
  }
  const g = generateGalaxy(s.seed);
  for (const sys of g) {
    if (
      Math.abs(sys.id - s.system) <= 2 &&
      !sys.secret &&
      !s.discovered.includes(sys.id)
    )
      s.discovered.push(sys.id);
    if (
      (has(s, "map") || has(s, "telescope")) &&
      Math.abs(sys.region - g[s.system].region) <= 1 &&
      !s.discovered.includes(sys.id)
    )
      s.discovered.push(sys.id);
  }
  s.contracts
    .filter((q) => q.type === "survey" && !q.complete)
    .forEach((q) => (q.progress += count));
  log(s, `Сканирование: ${count} новых контактов. Карта обновлена.`);
  for (const c of contacts(s)) {
    if (!s.scanned.includes(c.id)) continue;
    if (c.kind === "derelict") beginEncounter(s, "sos");
    if (c.kind === "anomaly") beginEncounter(s, "beacon");
  }
}
export function jump(s: State, id: number) {
  if (
    s.mode !== "space" ||
    id === s.system ||
    !s.discovered.includes(id) ||
    id < 0 ||
    id >= 25
  )
    return false;
  const cost = has(s, "jumpCost") ? 6 : 12;
  const range = has(s, "jump") ? 30 : 7;
  if (Math.abs(id - s.system) > range) {
    log(s, "Система вне дальности гипердвигателя (7 систем).");
    return false;
  }
  if (s.ship.fuel < cost) {
    log(
      s,
      "Для прыжка не хватает топлива. Используйте ячейку или добудьте лёд.",
    );
    return false;
  }
  if (escorts(s).some(({ ship }) => !escortInJumpRange(s, ship))) {
    log(
      s,
      "Конвой отстал: приблизьтесь к «Светляку» на 250 м перед гиперпрыжком.",
    );
    return false;
  }
  const from = s.system;
  s.ship.fuel -= cost;
  s.system = id;
  s.stats.jumps++;
  s.x = 0;
  s.y = 0;
  s.vx = 0;
  s.vy = 0;
  s.angle = -Math.PI / 2;
  s.enemies = [];
  s.projectiles = [];
  populateEnemies(s);
  jumpEscorts(s, from);
  scan(s);
  log(s, `Гиперпереход: ${generateGalaxy(s.seed)[id].name}`);
  return true;
}
export function interact(s: State): string | undefined {
  if (!s.physical) return finishInteraction(s);
  if (s.activity) {
    s.activity = null;
    log(s, "Работа прервана. Неиспользованные материалы остались на борту.");
    return;
  }
  const n = nearest(s);
  if (!n) return;
  if (
    ["interior", "surface", "derelict", "eva"].includes(s.mode) &&
    distance(s, n) > 70
  ) {
    log(s, "Подойдите к объекту на 70 м.");
    return;
  }
  let duration = 0,
    label = "";
  if (s.mode === "interior" && distance(s, n) <= 70) {
    const m = s.ship.modules.find((m) => m.id === n.id)!;
    if (s.intro === 0 && n.id === "fabricator") {
      duration = 1.8;
      label = "Собираете инструменты";
    } else if (
      (m.breach || m.integrity < 100 || m.fire > 0) &&
      quantity(s, "parts") > 0
    ) {
      duration = 4.5;
      label = `Ремонт: ${m.name}`;
    }
  } else if (
    s.mode === "surface" &&
    distance(s, n) <= 70 &&
    n.id !== `${s.location}-ship`
  ) {
    duration = n.id.endsWith("-ruin") ? 6 : 3;
    label = n.id.endsWith("-ruin") ? "Считываете архив" : "Извлекаете материал";
  } else if (
    s.mode === "derelict" &&
    distance(s, n) <= 70 &&
    s.enemies.length === 0
  ) {
    duration = 5;
    label = "Проверяете терминал";
  } else if (s.mode === "eva" && distance(s, n) <= 70) {
    duration = 5;
    label = "Герметизация корпуса";
  }
  if (!duration) return finishInteraction(s);
  s.activity = {
    target: n.id,
    mode: s.mode,
    system: s.system,
    location: s.location,
    x: n.x,
    y: n.y,
    elapsed: 0,
    duration,
    label,
  };
  log(s, `${label}. Останьтесь рядом до завершения; E отменяет работу.`);
}
export function tickInteraction(s: State, dt: number) {
  const a = s.activity;
  if (!a) return;
  if (
    s.mode !== a.mode ||
    s.system !== a.system ||
    s.location !== a.location ||
    distance(s, a) > 70 ||
    nearest(s)?.id !== a.target
  ) {
    s.activity = null;
    log(s, "Вы отошли от рабочего места. Работа прервана.");
    return;
  }
  a.elapsed += dt;
  if (a.elapsed >= a.duration) {
    s.activity = null;
    finishInteraction(s);
    remember(s, s.logs[0]);
  }
}
function finishInteraction(s: State): string | undefined {
  const n = nearest(s);
  if (!n) return;
  const d = distance(s, n);
  if (s.mode === "interior") {
    if (d > 95) {
      log(s, `Подойдите к отсеку «${n.name}».`);
      return;
    }
    const m = s.ship.modules.find((m) => m.id === n.id)!;
    if (s.intro === 0) {
      if (n.id !== "fabricator") {
        log(s, "Инструменты лежат у верстака, справа внизу.");
        return;
      }
      s.intro = 1;
      log(s, "Инструменты получены. Залатайте пробоину в шлюзе.");
      return;
    }
    const expected = ["airlock", "reactor", "engine"][s.intro - 1];
    if (n.id === expected && !m.breach && m.integrity === 100 && m.fire === 0) {
      s.intro++;
      log(
        s,
        s.intro === 4
          ? "Все системы в норме. Идите в кабину наверху."
          : s.intro === 3
            ? "Реактор работает. Проверьте двигатель справа."
            : "Шлюз герметичен. Проверьте реактор слева.",
      );
      return;
    }
    if (m.breach || m.integrity < 100 || m.fire > 0) {
      if (!consume(s, "parts")) {
        log(s, "Нужен ремкомплект. Создайте его из железа и меди.");
        return;
      }
      m.integrity = 100;
      m.breach = false;
      m.fire = 0;
      s.ship.hull = Math.min(shipStats(s).hull, s.ship.hull + 15);
      if (n.id === "airlock" && s.intro === 1) {
        s.intro = 2;
        log(s, "Пробоина закрыта. Теперь восстановите реактор слева в центре.");
      } else if (n.id === "reactor" && s.intro === 2) {
        s.intro = 3;
        log(s, "Реактор запущен. Почините двигатель справа в центре.");
      } else if (n.id === "engine" && s.intro === 3) {
        s.intro = 4;
        log(
          s,
          "Все системы в норме. Неизвестный сигнал зовёт с границы. Идите в кабину наверху.",
        );
      } else log(s, `${m.name}: ремонт завершён.`);
      return;
    }
    if (n.id === "cockpit") {
      if (s.intro < 4) {
        log(s, "Сначала завершите аварийный ремонт.");
        return;
      }
      enterSpace(s);
      log(
        s,
        "WASD или левый стик — тяга. Сканер открывает контакты. Выберите порт для автопилота.",
      );
      return;
    }
    if (n.id === "airlock" && s.intro >= 4) {
      s.mode = "eva";
      s.x = s.orbit.x;
      s.y = s.orbit.y + 60;
      s.vx = 0;
      s.vy = 0;
      log(s, "Скафандр герметичен. Вернитесь к кораблю кнопкой «На борт».");
      return;
    }
    return n.id === "medbay"
      ? "medical"
      : n.id === "fabricator"
        ? "craft"
        : "ship";
  }
  if (s.mode === "station") {
    if (d > 95) {
      log(s, "Подойдите к NPC или шлюзу.");
      return;
    }
    if (n.id === "dock") {
      const c = contacts(s).find((c) => c.id === s.location);
      s.mode = "space";
      s.x = (c?.x ?? 300) + 100;
      s.y = c?.y ?? -120;
      s.vx = 0;
      s.vy = 0;
      return;
    }
    if (n.id === "bar") {
      const lines = [
        "Эхо: «Исчезнувшие экипажи оставили мысли в камне. Ищите архив на любой планете этого региона».",
        "Мира: «Гелиос платит за уран. Колонистам нужны лёд и органика».",
        "Нокс: «Не идите к следующему узлу без щита. Контракты оплатят ремонт».",
      ];
      log(s, lines[Math.floor(s.time / 10) % 3]);
      scan(s);
      return "codex";
    }
    return n.id === "tech"
      ? "tech"
      : n.id === "trade"
        ? "trade"
        : n.id === "medical"
          ? "medical"
          : "quests";
  }
  if (s.mode === "surface") {
    if (d > 85) {
      log(s, "Подойдите ближе к объекту.");
      return;
    }
    const p = currentPlanet(s)!;
    const node = generateSurface(s.seed, p).find((node) => node.id === n.id)!;
    if (node.kind === "ship") {
      s.mode = "space";
      unloadResources(s);
      s.x = p.x + p.radius + 100;
      s.y = p.y;
      s.vx = 0;
      s.vy = 0;
      log(s, "Взлёт. Возвращение на орбиту.");
      return;
    }
    if (node.kind === "ruin") {
      if (s.scanned.includes(node.id)) {
        log(s, "Архив уже расшифрован.");
        return;
      }
      s.scanned.push(node.id);
      const region = generateGalaxy(s.seed)[s.system].region;
      if (
        (s.physical || region === s.chapter) &&
        !s.evidence.includes(region)
      ) {
        s.evidence.push(region);
        log(s, chapters[region].reveal);
        s.codex.push(chapters[region].reveal);
      }
      addItem(s, "exo", has(s, "ruins") ? 6 : 3);
      s.credits += 250;
      s.depleted[node.id] = node.amount;
      log(
        s,
        "Архив содержит неподтверждённые данные. Запись сохранена для расследования.",
      );
      return;
    }
    const remaining = node.amount - (s.depleted[node.id] ?? 0),
      extracted = Math.min(remaining, 2),
      amount = extracted * (has(s, "mining") ? 2 : 1);
    if (amount <= 0) return;
    if (!addItem(s, node.resource, amount)) {
      log(
        s,
        "Контейнер скафандра переполнен. Вернитесь к модулю для выгрузки.",
      );
      return;
    }
    s.depleted[node.id] = (s.depleted[node.id] ?? 0) + extracted;
    s.stats.mined += amount;
    s.contracts
      .filter((q) => q.type === "mining")
      .forEach((q) => (q.progress += amount));
    log(s, `Добыто: ${items[node.resource].name} ×${amount}`);
    return;
  }
  if (s.mode === "derelict") {
    if (d > 100) {
      log(s, "Ищите центральный терминал.");
      return;
    }
    salvageBoard(s);
    return;
  }
  if (s.mode === "eva") {
    if (d > 100) {
      log(s, "Подлетите ближе к корпусу.");
      return;
    }
    externalRepair(s);
    return;
  }
  const disabledShip = s.enemies.find((e) => e.id === n.id);
  if (disabledShip) {
    if (d > 120 || Math.hypot(s.vx, s.vy) > 80) {
      log(s, "Для абордажа подлетите ближе и снизьте скорость.");
      return;
    }
    s.kills.push(disabledShip.id);
    boardDerelict(s, "board:" + disabledShip.id);
    return;
  }
  const c = n as Contact;
  if (d > c.radius + 115) {
    log(s, "Подлетите ближе к контакту.");
    return;
  }
  if (c.kind === "planet") {
    s.location = c.id;
    s.mode = "surface";
    s.x = 0;
    s.y = 0;
    s.vx = 0;
    s.vy = 0;
    s.enemies = [];
    s.projectiles = [];
    log(s, `Посадка: ${c.name}. Архив отмечен на карте поверхности.`);
    return;
  }
  if (c.kind === "station" || c.kind === "outpost") {
    if (s.reputation[c.faction] < -60) {
      log(s, "Фракция отказывает в стыковке. Улучшите репутацию.");
      return;
    }
    const speed = Math.hypot(s.vx, s.vy);
    const align = Math.abs(
      Math.atan2(Math.sin(s.angle - Math.PI), Math.cos(s.angle - Math.PI)),
    );
    if (!has(s, "autodock") && (speed > 45 || align > 0.7)) {
      log(
        s,
        "Стыковка: скорость <45, нос налево (←). Нажмите «Автопилот» для выравнивания.",
      );
      return;
    }
    s.mode = "station";
    s.location = c.id;
    s.x = 0;
    s.y = 230;
    s.vx = 0;
    s.vy = 0;
    s.docked = true;
    s.health.oxygen = shipStats(s).oxygen;
    s.enemies = [];
    s.projectiles = [];
    log(
      s,
      `Добро пожаловать в ${c.name}. Рынок слева, контракты справа, верфь внизу.`,
    );
    beginEncounter(s, "inspection");
    return;
  }
  if (c.kind === "derelict") {
    boardDerelict(s, c.id);
    return;
  }
  if (c.kind === "asteroid") {
    if ((s.depleted[c.id] ?? 0) >= 30) {
      log(s, "Месторождение истощено.");
      return;
    }
    if (addItem(s, c.resource, has(s, "mining") ? 6 : 3)) {
      s.depleted[c.id] = (s.depleted[c.id] ?? 0) + 3;
      log(s, `Добыто: ${items[c.resource].name}`);
    }
    return;
  }
  if (!s.depleted[c.id]) {
    if (
      !addItem(
        s,
        has(s, "collector") ? "anomaly" : "crystal",
        has(s, "collector") ? 5 : 3,
      )
    ) {
      log(s, "Освободите грузовой отсек перед извлечением материи.");
      return;
    }
    s.depleted[c.id] = 1;
    s.credits += 100;
    s.health.radiation += 8;
    log(s, "Импульс аномалии. Вы извлекли материю, но получили дозу радиации.");
  }
}
export function launchBoss(s: State) {
  if (
    s.mode !== "space" ||
    s.chapter >= 5 ||
    !s.evidence.includes(s.chapter) ||
    Math.floor(s.system / 5) !== s.chapter ||
    s.enemies.some((e) => e.boss)
  )
    return false;
  const c = chapters[s.chapter];
  const hp = 400 + s.chapter * 230;
  const boss: Enemy = {
    id: `boss-${s.chapter}`,
    name: c.boss,
    x: s.x + 650,
    y: s.y - 100,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    hp,
    maxHp: hp,
    shield: s.chapter * 35,
    cooldown: 3,
    kind: c.type,
    phase: 1,
    disabled: 0,
    boss: true,
  };
  s.enemies = [boss];
  s.projectiles = [];
  log(
    s,
    `${c.boss}: «Ваше сознание будет сохранено». Цель появилась справа от корабля.`,
  );
  return true;
}
export function chooseEnding(s: State, choice: string) {
  if (s.bosses.length !== 5 || s.ending) return false;
  if (!["destroy", "control", "colonists"].includes(choice)) return false;
  s.ending = choice;
  const rep = s.reputation[2];
  const text = s.physical
    ? choice === "destroy"
      ? "Вы изолировали локальный узел Решётки. Переходы в Пределе продолжаются. Что скрывается за WELCOME BACK, всё ещё неизвестно."
      : choice === "control"
        ? "Вы оставили локальный узел под собственным наблюдением. Ответов меньше, чем вопросов. Жизнь капитана продолжается."
        : "Вы передали данные локального узла Лиге Свободного Предела. Совет назначил независимое расследование. Остальная Решётка остаётся загадкой."
    : choice === "destroy"
      ? "Вы уничтожили Хор. Последние голоса стали звёздным шумом. Галактика снова свободна."
      : choice === "control"
        ? "Вы приняли ключ Архитектора. Отныне ни одно сознание не будет сохранено без согласия."
        : rep >= 30
          ? "Вы передали Хор колонистам. Совет миров открыл добровольные пути между звёздами."
          : "Колонисты приняли сеть с недоверием. Надзорный совет ограничил её до восстановления доверия.";
  log(s, text);
  s.codex.push(text);
  return true;
}
export function randomEvent(s: State) {
  const rng = random(hash(`${s.seed}-${s.eventIndex++}-${s.system}`));
  const index = Math.floor(rng() * events.length),
    name = events[index];
  log(s, `Событие: ${name}.`);
  if ([0, 26].includes(index)) {
    beginEncounter(s, "sos");
  } else if (index === 8) {
    beginEncounter(s, "inspection");
  } else if (index === 27) {
    beginEncounter(s, "beacon");
  } else if ([1, 28].includes(index)) {
    const e: Enemy = {
      id: `event-${s.eventIndex}`,
      name: "Перехватчик",
      x: s.x + 750,
      y: s.y + 250,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 70 + Math.floor(s.system / 5) * 20,
      maxHp: 70 + Math.floor(s.system / 5) * 20,
      shield: 0,
      cooldown: 2,
      kind: "pirate",
      phase: 0,
      disabled: 0,
      boss: false,
    };
    if (s.enemies.length < 12) s.enemies.push(e);
  } else if ([5, 10, 13, 19, 29, 31].includes(index)) {
    if (!has(s, "meteor")) s.ship.hull = Math.max(1, s.ship.hull - 8);
    s.ship.heat += 12;
  } else if ([14, 15, 16, 17, 18, 30].includes(index)) {
    const m = s.ship.modules[Math.floor(rng() * s.ship.modules.length)];
    m.integrity = Math.max(20, m.integrity - (has(s, "cables") ? 10 : 25));
    if (index === 17) m.breach = true;
    if (index === 16) m.fire = 8;
    if (index === 15 && !has(s, "cables")) m.fire = 4;
    if (index === 14) s.ship.fuel = Math.max(0, s.ship.fuel - 6);
    log(s, `Авария: ${m.name}. Перейдите внутрь корабля для ремонта.`);
  } else if (index === 20) {
    s.ship.hull = Math.min(shipStats(s).hull, s.ship.hull + 15);
  } else if (index === 24) {
    addItem(s, "medkit", 1);
    addItem(s, "bandage", 2);
  } else if (index === 11) {
    scan(s);
  } else {
    addItem(s, index === 21 ? "crystal" : index === 25 ? "exo" : "iron", 2);
  }
}
export function recover(s: State) {
  s.credits = Math.max(
    0,
    s.credits - (has(s, "rescue") ? 100 : Math.floor(s.credits * 0.2)),
  );
  s.health = healthy();
  s.ship.hull = shipStats(s).hull;
  s.ship.fuel = Math.max(35, s.ship.fuel);
  s.ship.energy = shipStats(s).energy;
  s.ship.modules.forEach((m) => {
    m.fire = 0;
    m.breach = false;
    m.integrity = 100;
  });
  s.intro = 4;
  s.mode = "station";
  s.location = `${s.system}-s`;
  s.x = 0;
  s.y = 230;
  s.vx = 0;
  s.vy = 0;
  s.enemies = [];
  s.projectiles = [];
  log(s, "Спасатели доставили вас в порт. Удержана плата за эвакуацию.");
}
export function canUseSupply(s: State, id: string) {
  return id === "fuel"
    ? s.ship.fuel < 100
    : id === "oxygen"
      ? s.health.oxygen < shipStats(s).oxygen
      : id === "food"
        ? s.health.hunger < 100
        : id === "ammo"
          ? true
          : id === "parts"
            ? s.ship.hull < shipStats(s).hull
            : id === "probe"
              ? generateGalaxy(s.seed).some(
                  (sys) =>
                    sys.region === Math.floor(s.system / 5) &&
                    !s.discovered.includes(sys.id),
                )
              : false;
}
export function useSupply(s: State, id: string) {
  if (
    !["fuel", "oxygen", "food", "ammo", "parts", "probe"].includes(id) ||
    !canUseSupply(s, id) ||
    !consume(s, id)
  )
    return false;
  if (id === "fuel") s.ship.fuel = Math.min(100, s.ship.fuel + 30);
  if (id === "oxygen")
    s.health.oxygen = Math.min(shipStats(s).oxygen, s.health.oxygen + 45);
  if (id === "food") s.health.hunger = Math.min(100, s.health.hunger + 45);
  if (id === "ammo") s.ship.ammo += 30;
  if (id === "parts")
    s.ship.hull = Math.min(shipStats(s).hull, s.ship.hull + 25);
  if (id === "probe") {
    generateGalaxy(s.seed)
      .filter((sys) => sys.region === Math.floor(s.system / 5))
      .forEach((sys) => {
        if (!s.discovered.includes(sys.id)) s.discovered.push(sys.id);
      });
    log(s, "Зонд открыл весь регион.");
  }
  return true;
}
