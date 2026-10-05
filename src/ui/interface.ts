import type { State, Contract } from "../core/types";
import {
  items,
  recipes,
  chapters,
  upgrades,
  ships,
  regions,
  factions,
  biomes,
} from "../data/catalog";
import { generateGalaxy } from "../world/galaxy";
import {
  contextLabel,
  currentPlanet,
  contacts,
  canUseSupply,
} from "../core/actions";
import { has, shipStats, weight, quantity } from "../core/state";
import {
  inventoryWeight,
  inventorySlots,
  reservedCargo,
} from "../core/inventory";
import {
  contractOffers,
  price,
  canAcceptContract,
  canClaimContract,
  destinationName,
  missionTarget,
} from "../core/economy";
import { escorts } from "../core/escort";
import { pendingEncounters, choiceUnavailable } from "../core/encounters";
import { encounterDefinitions } from "../data/encounters";
import { slots } from "../save/storage";
export const esc = (text: unknown) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const button = (
  text: string,
  action: string,
  param = "",
  disabled = false,
  cls = "",
) =>
  `<button class="${cls}" data-action="${action}" data-param="${esc(param)}" ${disabled ? "disabled" : ""}>${text}</button>`;
const tabs = [
  ["inventory", "Груз"],
  ["medical", "Медицина"],
  ["character", "Персонаж"],
  ["ship", "Корабль"],
  ["galaxy", "Карта"],
  ["quests", "Журнал"],
  ["encounters", "Сигналы"],
  ["tech", "Технологии"],
  ["craft", "Крафт"],
  ["trade", "Рынок"],
  ["codex", "Кодекс"],
  ["settings", "Настройки"],
  ["help", "Помощь"],
];
export class Interface {
  panel = "";
  medicalPart = 1;
  selectedSystem = -1;
  activeSlot = 0;
  quickIndex = 0;
  toastTimer = 0;
  private root: HTMLElement;
  private lastLog = "";
  constructor(
    private state: () => State,
    private action: (action: string, param: string) => void,
  ) {
    this.root = document.getElementById("app")!;
    this.root.innerHTML = `<canvas id="world" aria-label="Игровой мир STARFALL"></canvas><div id="landing"></div><div id="game-ui" hidden><header class="hud-header"><div class="wordmark">STARFALL<span>VOID FRONTIER</span></div><div id="system-name"></div><div class="header-actions">${button("Сохранить", "save", "", false, "quiet").replace(" disabled", "")}${button("☰ <span>Меню</span>", "panel", "ship", false, "quiet")}</div></header><aside id="telemetry"></aside><aside id="objective"></aside><div id="radio"></div><nav class="quick-nav">${button("◈ <span>Карта</span>", "panel", "galaxy")}${button("▣ <span>Груз</span>", "panel", "inventory")}${button("✚ <span>Медицина</span>", "panel", "medical")}${button("≡ <span>Журнал</span>", "panel", "quests")}</nav><div class="flight-actions">${button("⤢ Сканер", "scan")}${button("◎ Автопилот", "autopilot")}<button id="boost-button">⇡ Форсаж</button><button id="brake-button">⏸ Тормоз</button><button id="fire-button" class="danger">◎ Огонь</button>${button("▤ На борт", "board")}<button id="interact-button" class="primary" data-action="interact">Взаимодействовать</button></div><div class="stick" id="stick-left"><span class="stick-label">ДВИЖЕНИЕ</span><div class="stick-thumb"></div></div><div class="stick" id="stick-right"><span class="stick-label">ПРИЦЕЛ / ОГОНЬ</span><div class="stick-thumb"></div></div><div id="autosave">● АВТОСОХРАНЕНИЕ</div></div><div id="modal" hidden></div><div id="toast" role="status"></div><input type="file" id="import-file" accept=".json,application/json" hidden>`;
    this.root.addEventListener("click", (event) => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-action]",
      );
      if (!b || b.disabled) return;
      this.action(b.dataset.action!, b.dataset.param ?? "");
    });
  }
  landing() {
    let saved: ReturnType<typeof slots> = [];
    try {
      saved = slots();
    } catch {}
    const slot = saved[this.activeSlot];
    document.getElementById("landing")!.hidden = false;
    document.getElementById("game-ui")!.hidden = true;
    this.panel = "";
    document.getElementById("modal")!.hidden = true;
    document.getElementById("landing")!.innerHTML =
      `<div class="landing-top"><div class="wordmark">STARFALL<span>VOID FRONTIER</span></div><span class="version-tag">SINGLE PLAYER / 01</span></div><div class="landing-layout"><section class="hero"><div class="eyebrow"><span class="status-light"></span> СИГНАЛ С ГРАНИЦЫ ОБНАРУЖЕН</div><h1>STAR<span>FALL</span><small>VOID FRONTIER</small></h1><p class="hero-copy">2497 год. Предел живёт между звёздами.<br>Старый корабль. Ваш первый рейс.</p><p class="hero-detail">Почините корабль. Найдите работу и свой путь.<br>У каждой экспедиции — своя история.</p><div class="launch-buttons">${slot?.state ? button("Продолжить экспедицию →", "continue", String(this.activeSlot), false, "primary large") : ""}${button(slot?.state ? "Новая экспедиция" : "Начать экспедицию →", "new", String(this.activeSlot), false, slot?.state ? "large" : "primary large")}</div><div class="setup-inputs"><label>ПОЗЫВНОЙ<input id="pilot-name" maxlength="40" value="Пилот" aria-label="Позывной"/></label><label>SEED ГАЛАКТИКИ<input id="world-seed" maxlength="80" value="STARFALL" aria-label="Seed галактики"/></label></div><div class="save-slots">${[0, 1, 2].map((i) => button(`<span class="slot-num">0${i + 1}</span><span>${saved[i]?.state ? esc(saved[i].state!.name) : "Пустой слот"}<small>${saved[i]?.state ? `Глава ${Math.min(5, saved[i].state!.chapter + 1)} / ${Math.round(saved[i].state!.time / 60)} мин` : "НОВАЯ ЭКСПЕДИЦИЯ"}</small></span>`, "slot", String(i), false, this.activeSlot === i ? "selected" : "")).join("")}</div>${button("Импорт сохранения", "import", "", false, "text-button").replace(" disabled", "")}<p class="landing-note">Сохранения остаются в этом браузере. Экспортируйте копию перед очисткой данных.</p></section><aside class="landing-card"><div class="eyebrow">БОРТОВОЙ ЖУРНАЛ / 001</div><h2>Последний<br>выживший.</h2><p>Ваша регистрация — Freelance Captain. По Конвенции Пустоты капитан отвечает за судно и людей на борту. Сейчас воздух уходит через шлюз, а деньги нужны даже на дорогу до порта.</p><div class="card-divider"></div><div class="feature-row"><span>25</span><div>ЗВЁЗДНЫХ СИСТЕМ<small>Торговые пути, независимые порты и Long Dark.</small></div></div><div class="feature-row"><span>06</span><div>СИЛ ПРЕДЕЛА<small>Содружество, Helix, Лига, Blackwake, Последний Свет и Институт.</small></div></div><div class="feature-row"><span>∞</span><div>ВАША ЭКСПЕДИЦИЯ<small>Добыча, торговля, бой и исследование.</small></div></div><div class="card-footer"><span class="status-light"></span> КЕСТРЕЛ / АВАРИЙНЫЙ РЕЖИМ</div></aside></div><footer class="landing-footer"><span>WASD · E · ПРОБЕЛ / TOUCH CONTROLS</span><span>БЕЗ СЕРВЕРА · БЕЗ РЕГИСТРАЦИИ</span></footer>`;
  }
  start() {
    document.getElementById("landing")!.hidden = true;
    document.getElementById("game-ui")!.hidden = false;
    this.close();
    this.update();
  }
  open(panel: string) {
    this.panel = panel;
    document.getElementById("modal")!.hidden = false;
    this.renderPanel();
  }
  close() {
    this.panel = "";
    document.getElementById("modal")!.hidden = true;
  }
  refresh() {
    if (this.panel) this.renderPanel();
    this.update();
  }
  private gauge(label: string, value: number, max: number, color: string) {
    return `<div class="gauge"><div><span>${label}</span><strong>${Math.round(value)}<small> / ${Math.round(max)}</small></strong></div><div class="gauge-track"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%;background:${color}"></i></div></div>`;
  }
  update() {
    const s = this.state(),
      stats = shipStats(s),
      sys = generateGalaxy(s.seed)[s.system];
    document.documentElement.style.setProperty(
      "--ui-scale",
      String(s.settings.uiScale),
    );
    // Keep both HUD columns within narrow screens; apply scale once to text.
    document.documentElement.style.setProperty(
      "--hud-scale",
      String(
        Math.min(
          s.settings.uiScale,
          window.innerWidth < 700 ? (window.innerWidth - 36) / 303 : 1.5,
        ),
      ),
    );
    document.documentElement.style.setProperty(
      "--stick-size",
      Math.min(
        s.settings.stickSize,
        Math.max(70, (window.innerWidth - 120) / 2),
      ) + "px",
    );
    document.documentElement.style.setProperty(
      "--control-opacity",
      String(s.settings.opacity),
    );
    document.getElementById("system-name")!.innerHTML =
      `<span>${esc(sys.name)} <i> / ${esc(regions[sys.region])}</i></span><small>${s.mode === "space" ? "СВОБОДНЫЙ ПОЛЁТ" : s.mode === "interior" ? "НА БОРТУ" : s.mode === "surface" ? "ПОВЕРХНОСТЬ" : s.mode === "station" ? "СТЫКОВКА" : s.mode === "eva" ? "ВНЕ КОРАБЛЯ" : "АБОРДАЖ"} · ${Math.round(Math.hypot(s.vx, s.vy))} м/с</small>`;
    document.getElementById("telemetry")!.innerHTML =
      `<div class="panel-label">${esc(s.ship.name)} <span>●</span></div>${this.gauge("КОРПУС", s.ship.hull, stats.hull, "#89dce1")}${stats.shield ? this.gauge("ЩИТ", s.ship.shield, stats.shield, "#ad9be2") : ""}${this.gauge("КИСЛОРОД", s.health.oxygen, stats.oxygen, s.health.oxygen < 25 ? "#ed8b81" : "#a5becc")}${this.gauge("ТОПЛИВО", s.ship.fuel, 100, "#e9ba78")}${this.gauge("ЭНЕРГИЯ", s.ship.energy, stats.energy, "#a1bad3")}${escorts(
        s,
      )
        .filter((e) => e.ship.system === s.system)
        .map((e) =>
          this.gauge("КОНВОЙ", e.ship.hull, e.ship.maxHull, "#8bd5a2"),
        )
        .join(
          "",
        )}<div class="telemetry-footer"><span>${s.ship.ammo} ПАТР.</span><strong>₡ ${s.credits.toLocaleString("ru")}</strong></div>`;
    const chapter = chapters[Math.min(s.chapter, 4)];
    const intro = [
      "Найдите инструменты у верстака справа внизу. Подойдите и нажмите E или кнопку действия.",
      "Залатайте пробоину: шлюз внизу корабля.",
      "Восстановите реактор слева в центре.",
      "Запустите двигатель справа в центре.",
      "Идите в кабину наверху и сядьте за штурвал.",
    ];
    document.getElementById("objective")!.innerHTML =
      `<div class="panel-label">${s.intro < 4 ? "АВАРИЙНЫЙ ПРОТОКОЛ" : "АКТИВНЫЙ СИГНАЛ"} <span>0${Math.min(5, s.chapter + 1)}</span></div><h3>${s.intro < 4 ? "Вернуться к звёздам" : s.chapter >= 5 ? "Судьба Хора" : chapter.name}</h3><p>${esc(s.intro < 4 ? intro[s.intro] : !s.docked ? "Посетите орбитальный порт. Сканируйте контакты и выберите порт для автопилота." : s.chapter >= 5 ? (s.ending ? "Сеть изменилась. Экспедиция продолжается." : "Откройте журнал и примите последнее решение.") : s.evidence.includes(s.chapter) ? `Ключ найден. Вызовите стража «${chapter.boss}» через журнал в космосе.` : `Найдите Архив Хора на планете региона «${regions[s.chapter]}».`)}</p>`;
    if (s.physical && s.intro >= 4)
      document.getElementById("objective")!.innerHTML =
        '<div class="panel-label">2497 / THE REACH</div><h3>Вольный капитан</h3><p>' +
        esc(
          !s.docked
            ? "Найдите порт, приведите корабль в порядок и решите, куда отправиться."
            : s.ship.hull < 60
              ? "Кораблю нужен ремонт. Запаситесь деталями перед дальней дорогой."
              : pendingEncounters(s).length
                ? "В журнале ждут радиосигналы. Помощь, риск или отказ — ваше решение."
                : "Зарабатывайте, исследуйте и возвращайтесь домой. Расследование Решётки необязательно.",
        ) +
        "</p>";
    const latest = s.logs[0];
    if (latest !== this.lastLog) {
      this.lastLog = latest;
      document.getElementById("radio")!.innerHTML =
        `<span>▥ БОРТОВОЙ КАНАЛ</span><p>${esc(latest)}</p>`;
    }
    document.getElementById("interact-button")!.textContent = contextLabel(s);
    const journal = document.querySelector<HTMLButtonElement>(
      '.quick-nav [data-param="quests"]',
    )!;
    journal.innerHTML = `≡ <span>Журнал${pendingEncounters(s).length ? ` · ${pendingEncounters(s).length}` : ""}</span>`;
    document.querySelector<HTMLButtonElement>('[data-action="board"]')!.hidden =
      !["space", "eva", "derelict", "surface"].includes(s.mode);
    document.querySelector<HTMLButtonElement>(
      '[data-action="board"]',
    )!.textContent = s.mode === "surface" ? "⌖ К модулю" : "▤ На борт";
    document.querySelector<HTMLButtonElement>('[data-action="scan"]')!.hidden =
      !["space", "eva"].includes(s.mode);
    for (const id of ["boost-button", "brake-button"])
      document.getElementById(id)!.hidden = !["space", "eva"].includes(s.mode);
    document.getElementById("fire-button")!.hidden = ![
      "space",
      "surface",
      "derelict",
    ].includes(s.mode);
  }
  toast(message: string) {
    const t = document.getElementById("toast")!;
    t.textContent = message;
    t.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => t.classList.remove("visible"),
      4500,
    );
  }
  saved() {
    const node = document.getElementById("autosave")!;
    node.classList.add("visible");
    setTimeout(() => node.classList.remove("visible"), 2000);
  }
  private renderPanel() {
    const title = tabs.find((t) => t[0] === this.panel)?.[1] ?? "Меню";
    document.getElementById("modal")!.innerHTML =
      `<section class="menu-shell"><header class="menu-header"><div><span class="eyebrow">KESTREL / БОРТОВОЙ ТЕРМИНАЛ</span><h2>${title}</h2></div>${button("✕", "close", "", false, "close-button").replace(" disabled", "")}</header><nav class="menu-tabs">${tabs.map(([id, name]) => button(name, "panel", id, false, this.panel === id ? "active" : "")).join("")}</nav><div class="menu-content">${this.content()}</div><footer class="menu-footer"><span>СИМУЛЯЦИЯ ПРИОСТАНОВЛЕНА</span>${button("Вернуться в игру →", "close", "", false, "primary")}</footer></section>`;
  }
  private inventoryMenu(s: State) {
    const cards = (pool: Record<string, number>, packed: boolean) =>
      Object.entries(pool)
        .filter(([, n]) => n > 0)
        .map(
          ([id, n]) =>
            `<article class="item-card"><div class="item-icon" style="color:${items[id].color}">${items[id].kind === "resource" ? "⬡" : items[id].kind === "medical" ? "✚" : "▣"}</div><div><h4>${esc(items[id].name)} <b>×${n}</b></h4><p>${esc(items[id].description)}</p><small>${(items[id].weight * n).toFixed(1)} кг / ${Math.ceil(n / 99)} слот</small></div><div class="item-actions">${items[id].kind === "medical" ? button("Лечить", "panel", "medical") : items[id].kind === "supply" ? button("Использовать", "use", id, !canUseSupply(s, id)) : ""}${button(packed ? "На корабль" : "В скафандр", "transfer", `${packed ? "cargo" : "pack"}:${id}`, !["space", "station", "interior"].includes(s.mode))}${items[id].kind !== "resource" ? button("На панель", "quickAssign", id) : ""}${has(s, "recycle") ? button("Разобрать", "recycle", id, id === "iron") : ""}${button("Выбросить 1", "discard", `${packed ? "pack" : "cargo"}:${id}`)}</div></article>`,
        )
        .join("");
    return `<div class="section-intro"><h3>Быстрые припасы</h3><p>Клавиши 1–4 на ПК. «На панель» назначает предмет в следующий слот.</p></div><div class="supply-row">${s.quickSlots.map((id, i) => button(`${i + 1} · ${items[id].name} ×${quantity(s, id)}`, "quick", String(i), !quantity(s, id) || (items[id].kind === "supply" && !canUseSupply(s, id)))).join("")}</div><div class="section-intro"><h3>Скафандр</h3><p>${inventoryWeight(s.pack).toFixed(1)} / 35 кг · ${inventorySlots(s.pack)} / 12 слотов. Добыча на планетах попадает сюда. При взлёте ресурсы выгружаются в корабль, если есть место.</p></div><div class="item-grid">${cards(s.pack, true) || '<p class="muted">Контейнер пуст.</p>'}</div><div class="section-intro"><h3>Грузовой отсек</h3><p>${weight(s).toFixed(1)} / ${shipStats(s).cargo} кг · ${inventorySlots(s.inventory) + reservedCargo(s).slots} / 40 слотов. Стак: до 99 единиц на слот.</p></div><div class="item-grid">${cards(s.inventory, false)}</div><div class="section-intro"><h3>Контрактный манифест</h3><p>${reservedCargo(s).weight} кг зарезервировано. Эти грузы защищены от расходования.</p></div><div class="list">${
      s.contracts
        .filter((q) => missionTarget(q))
        .map(
          (q) =>
            `<div class="list-row"><div><strong>${esc(q.mission!.manifest.label)}</strong><p>${esc(q.title)} · ${q.mission!.manifest.weight} кг</p></div>${button("Маршрут", "missionRoute", q.id)}</div>`,
        )
        .join("") || "<p>Контрактного груза нет.</p>"
    }</div>`;
  }
  private contractsMenu(s: State) {
    const describe = (q: Contract) => {
      const m = q.mission,
        target = missionTarget(q);
      if (!m)
        return `${q.item ? `${items[q.item]?.name}: ${quantity(s, q.item)}/${q.target}` : `Прогресс: ${Math.min(q.progress, q.target)}/${q.target}`} · ₡ ${q.reward}`;
      return `${esc(m.manifest.label)}${m.escort ? ` · Корпус ${Math.ceil(m.escort.hull)}/${m.escort.maxHull}${m.escort.arrived ? " · В порту" : " · Держитесь в пределах 250 м при прыжке"}` : ""} · ${m.manifest.weight} кг / ${m.manifest.slots} сл.<br>${m.stage === "failed" ? "Провален — конвой уничтожен" : m.stage === "cancelled" ? "Отменён — груз передан портовой службе" : m.stage === "done" ? "Доставлено" : `${m.stage === "pickup" ? "Спасти у терминала после боя" : "Доставить"}: ${esc(destinationName(s, target!))}`} · ₡ ${q.reward}`;
    };
    return `<div class="section-intro"><h3>Контракты</h3><p>Опечатанный груз и пассажирское оборудование занимают место в корабле. Сдача возможна только в назначенном порту. Спасение: абордаж, охрана, центральный терминал, возвращение. Конвой: держитесь рядом, защищайте корабль и доведите его до порта. Отмена в порту снижает репутацию на 4.</p></div><div class="list">${s.contracts.map((q) => `<div class="list-row"><div><strong>${esc(q.title)} ${q.complete ? "✓" : ""}</strong><p>${describe(q)}</p></div><div class="contract-actions">${missionTarget(q) ? button("Маршрут", "missionRoute", q.id) : ""}${button(q.complete ? "Сдано" : q.mission?.stage === "failed" ? "Провален" : q.mission?.stage === "cancelled" ? "Отменён" : "Сдать", "claim", q.id, !canClaimContract(s, q))}${q.mission && missionTarget(q) ? button("Отменить · −4 реп.", "cancelContract", q.id, s.mode !== "station", "quiet") : ""}</div></div>`).join("") || '<p class="muted">Активных контрактов нет.</p>'}${
      s.mode === "station"
        ? contractOffers(s)
            .filter((q) => !s.contracts.some((c) => c.id === q.id))
            .map(
              (q) =>
                `<div class="list-row"><div><strong>${esc(q.title)}</strong><p>${describe(q)}</p></div>${button("Принять", "accept", q.id, !canAcceptContract(s, q))}</div>`,
            )
            .join("")
        : ""
    }</div><div class="section-intro"><h3>Репутация</h3></div><div class="reputation-grid">${factions.map((f, i) => `<div>${f}<strong class="${s.reputation[i] < 0 ? "negative" : "positive"}">${s.reputation[i] > 0 ? "+" : ""}${s.reputation[i]}</strong></div>`).join("")}</div>`;
  }
  private missionMap(s: State) {
    const g = generateGalaxy(s.seed),
      origin = g[s.system];
    return s.contracts
      .map((q) => {
        const target = missionTarget(q);
        if (!target) return "";
        const dest = g[target.system];
        return `<g class="mission-map-marker"><title>${esc(q.title)}: ${esc(destinationName(s, target))}</title><line x1="${origin.x}" y1="${origin.y}" x2="${dest.x}" y2="${dest.y}" stroke="#ffb66b" stroke-dasharray="8 5"/><circle cx="${dest.x}" cy="${dest.y}" r="30" fill="none" stroke="#ffb66b" stroke-width="2"/><text x="${dest.x}" y="${dest.y - 35}" text-anchor="middle" fill="#ffb66b">◆ Контракт</text></g>`;
      })
      .join("");
  }
  private content() {
    const s = this.state(),
      stats = shipStats(s),
      sys = generateGalaxy(s.seed)[s.system],
      station = contacts(s).find((c) => c.id === s.location),
      faction = station?.faction ?? s.system % 3;
    switch (this.panel) {
      case "inventory":
        return this.inventoryMenu(s);
      case "character":
        return `<div class="section-intro"><h3>${esc(s.name)}</h3><p>Цвета и скафандр отображаются при ходьбе на корабле, в портах и на поверхности.</p></div><div class="settings-grid"><label>Цвет кожи<input id="avatar-skin" type="color" value="${s.avatar.skin}"/></label><label>Цвет одежды<input id="avatar-suit" type="color" value="${s.avatar.suit}"/></label><label>Цвет волос<input id="avatar-hair" type="color" value="${s.avatar.hair}"/></label><label>Волосы<select id="avatar-style"><option value="0" ${s.avatar.style === 0 ? "selected" : ""}>Короткие</option><option value="1" ${s.avatar.style === 1 ? "selected" : ""}>Средние</option><option value="2" ${s.avatar.style === 2 ? "selected" : ""}>Длинные</option></select></label><label class="checkbox"><input id="avatar-helmet" type="checkbox" ${s.avatar.helmet ? "checked" : ""}/>Шлем скафандра</label>${button("Применить", "avatar")}</div>`;
      case "medical": {
        const h = s.health,
          p = h.parts[this.medicalPart],
          names: Record<string, string> = {
            cut: "Порез",
            burn: "Ожог",
            fracture: "Перелом",
            cold: "Обморожение",
            toxin: "Токсины",
            radiation: "Радиация",
            puncture: "Прокол",
            bruise: "Ушиб",
            suffocation: "Удушье",
          };
        return `<div class="medical-layout"><div class="body-scan"><div class="eyebrow">БИОМЕТРИЯ / LIVE</div><div class="body-figure">${h.parts.map((p, i) => button(`<span>${Math.round(p.health)}%</span>`, "body", String(i), false, `body-part part-${i} ${this.medicalPart === i ? "active" : ""} ${p.health < 70 ? "injured" : ""}`)).join("")}</div><div class="body-caption">Нажмите на часть тела</div>${this.gauge("КРОВЬ", h.blood, 100, "#ed9296")}${this.gauge("СОЗНАНИЕ", h.consciousness, 100, "#a1d5cb")}<p class="muted">Боль ${Math.round(h.pain)} · Радиация ${Math.round(h.radiation)}<br>${h.stimulant > 0 ? `Стимулятор: ${Math.ceil(h.stimulant)} с<br>` : ""}Температура ${h.temperature.toFixed(1)} °C · Сытость ${Math.round(h.hunger)}%</p></div><div><div class="section-intro"><h3>${esc(p.name)}</h3><p>Состояние тканей: ${Math.round(p.health)}%. ${
          Object.keys(p.wounds).length
            ? Object.entries(p.wounds)
                .map(([w, n]) => `${names[w]} ${Math.ceil(n!)}`)
                .join(" · ")
            : "Ранений нет"
        }</p></div><div class="list">${Object.entries(items)
          .filter(([, i]) => i.kind === "medical")
          .map(
            ([id, i]) =>
              `<div class="list-row"><div><strong>${i.name}</strong><p>${i.description}</p></div>${button(`Применить (${quantity(s, id)})`, "treat", id, !quantity(s, id))}</div>`,
          )
          .join(
            "",
          )}</div>${s.mode === "station" ? button("Полное лечение · ₡ 120", "clinic", "", s.credits < 120, false ? "" : "primary") : ""}</div></div>`;
      }
      case "ship":
        return `<div class="section-intro"><h3>${esc(s.ship.name)} / ${esc(ships.find((x) => x.id === s.ship.class)?.name)}</h3><p>Пожары повреждают корпус. Пробоины расходуют кислород. Подойдите к отсеку внутри корабля и используйте ремкомплект.</p></div><div class="ship-summary"><span>КОРПУС <strong>${Math.round(s.ship.hull)} / ${stats.hull}</strong></span><span>ЩИТ <strong>${Math.round(s.ship.shield)} / ${stats.shield}</strong></span><span>ТЯГА <strong>${Math.round(stats.speed)} м/с</strong></span><span>НАГРЕВ <strong>${Math.round(s.ship.heat)}%</strong></span></div><div class="module-grid">${s.ship.modules.map((m) => `<article class="module-card"><h4>${m.name}</h4>${this.gauge("ИНТЕГРИТЕТ", m.integrity, 100, m.integrity < 70 ? "#eaa381" : "#84cfd2")}<p>${m.breach ? "⚠ ПРОБОИНА" : "● Герметичен"} · ${m.fire > 0 ? "Пожар " + Math.round(m.fire) : "Температура нормальная"}</p>${button("Перейти к отсеку", "navigate", m.id, s.mode !== "interior")}</article>`).join("")}</div><div class="section-intro"><h3>Оружейная система</h3><p>Энергооружие использует реактор. Кинетика и ракеты расходуют патроны.</p></div><div class="weapon-select">${[
          ["kinetic", "Кинетика"],
          ["laser", "Лазер"],
          ["missile", "Ракеты"],
          ["rail", "Рельсотрон"],
          ["ion", "Ионная пушка"],
          ["plasma", "Плазма"],
          ["mine", "Мины"],
        ]
          .map(([id, name]) =>
            button(
              name,
              "weapon",
              id,
              id !== "kinetic" && !has(s, id),
              s.ship.weapon === id ? "active" : "",
            ),
          )
          .join(
            "",
          )}</div>${s.mode === "station" ? `<div class="section-intro"><h3>Обслуживание и верфь</h3></div>${button("Ремонт и заправка · ₡ 180", "service", "", s.credits < 180)}<div class="list">${ships.map((ship) => `<div class="list-row"><div><strong>${ship.name}</strong><p>Корпус ${ship.hull} · Скорость ${ship.speed} · Груз ${ship.cargo}</p></div>${button(s.ship.class === ship.id ? "Текущий" : `Купить · ₡ ${ship.cost}`, "buyShip", ship.id, s.ship.class === ship.id || s.credits < ship.cost || weight(s) > shipStats({ ...s, ship: { ...s.ship, class: ship.id } }).cargo)}</div>`).join("")}</div>` : ""}<div class="section-intro"><h3>Персонализация</h3></div><form id="customize-form" class="settings-grid"><label>Название корабля<input id="ship-name" maxlength="40" value="${esc(s.ship.name)}"/></label><label>Основной цвет<input id="ship-color" type="color" value="${esc(s.ship.color)}"/></label><label>Акцент<input id="ship-accent" type="color" value="${esc(s.ship.accent)}"/></label>${button("Применить", "customize")}</form>`;
      case "galaxy": {
        const g = generateGalaxy(s.seed);
        const selected =
          g[this.selectedSystem >= 0 ? this.selectedSystem : s.system];
        return `<div class="section-intro"><h3>Галактическая карта</h3><p>Сканируйте и запускайте зонды, чтобы открыть маршруты. Прыжок расходует ${has(s, "jumpCost") ? 6 : 12} топлива. Дальность: ${has(s, "jump") ? "вся галактика" : "7 систем"}.</p></div><div class="galaxy-scroll"><svg class="galaxy-map" viewBox="0 0 1120 620" aria-label="Карта галактики">${regions.map((r, i) => `<rect x="${i * 220}" y="0" width="218" height="610" fill="${i % 2 ? "#102031" : "#0a1625"}"/><text x="${i * 220 + 20}" y="30" class="region-label">0${i + 1} / ${r}</text>`).join("")}${g
          .filter((x) => s.discovered.includes(x.id))
          .map((x) => {
            const next = g[x.id + 1];
            return next && s.discovered.includes(next.id)
              ? `<line x1="${x.x}" y1="${x.y}" x2="${next.x}" y2="${next.y}" stroke="#3c5363" stroke-dasharray="4 6"/>`
              : "";
          })
          .join(
            "",
          )}${g.map((x) => (s.discovered.includes(x.id) ? `<g role="button" tabindex="0" data-system="${x.id}"><circle cx="${x.x}" cy="${x.y}" r="25" fill="transparent"/><circle cx="${x.x}" cy="${x.y}" r="${x.id === s.system ? 12 : 7}" fill="${x.color}"/><circle cx="${x.x}" cy="${x.y}" r="${x.id === this.selectedSystem ? 22 : x.id === s.system ? 19 : 14}" fill="none" stroke="${x.id === s.system ? "#80dde1" : "#526677"}"/><text x="${x.x}" y="${x.y + 40}" text-anchor="middle">${esc(x.name)}${x.secret ? " ◈" : ""}</text></g>` : `<text x="${x.x}" y="${x.y}" fill="#344858" text-anchor="middle">?</text>`)).join("")}${this.missionMap(s)}</svg></div><div class="map-detail"><div><h3>${esc(selected.name)}</h3><p>${regions[selected.region]} · Опасность ${selected.region + 1}/5 · ${selected.contacts.filter((c) => c.kind === "planet").length} планет</p></div>${button(selected.id === s.system ? "Вы здесь" : `Гиперпереход → ${selected.name}`, "jump", String(selected.id), selected.id === s.system || s.mode !== "space" || !s.discovered.includes(selected.id), "primary")}</div><div class="section-intro"><h3>Контакты текущей системы</h3><p>Выбор контакта включает автопилот и закрывает карту.</p></div><div class="contact-grid">${contacts(
          s,
        )
          .map((c) =>
            button(
              `<span>${c.kind === "planet" ? "◉" : c.kind === "station" ? "⊕" : "◇"} ${
                s.contracts.some((q) => {
                  const t = missionTarget(q);
                  return t?.system === s.system && t.location === c.id;
                })
                  ? "◆ "
                  : ""
              }${s.scanned.includes(c.id) ? esc(c.name) : "? Контакт"}</span><small>${Math.round(Math.hypot(c.x - s.x, c.y - s.y))} м${c.kind === "planet" && s.scanned.includes(c.id) ? " · " + biomes[c.biome].name : ""}</small>`,
              "navigate",
              c.id,
              s.mode !== "space",
            ),
          )
          .join("")}</div>`;
      }
      case "quests":
        return `${button(`Радиосигналы · ${pendingEncounters(s).length} открытых`, "panel", "encounters")}<div class="story-card"><div class="eyebrow">${s.physical ? "НЕОБЯЗАТЕЛЬНОЕ РАССЛЕДОВАНИЕ / РЕШЁТКА" : `ГЛАВА 0${Math.min(s.chapter + 1, 5)} / ${s.bosses.length} ИЗ 5 СТРАЖЕЙ`}</div><h3>${chapters[Math.min(s.chapter, 4)].name}</h3><p>${chapters[Math.min(s.chapter, 4)].text}</p><div class="story-steps"><span class="${s.intro >= 4 ? "done" : ""}">✓ Восстановить корабль</span><span class="${s.docked ? "done" : ""}">✓ Посетить станцию</span><span class="${s.evidence.includes(s.chapter) || s.chapter >= 5 ? "done" : ""}">✓ Найти ключ в руинах</span></div>${s.chapter < 5 ? button(`Вызвать стража: ${chapters[s.chapter].boss}`, "boss", "", !s.evidence.includes(s.chapter) || s.mode !== "space" || sys.region !== s.chapter || s.enemies.some((e) => e.boss), "primary") : s.ending ? `<p class="ending-text">${esc(s.codex[s.codex.length - 1])}</p>${button("Продолжить исследование", "close")}` : `<h3>Последний выбор</h3><p>Вы получили доступ к локальному узлу. Остальная Решётка остаётся неизвестной. Решение касается только этого объекта.</p><div class="ending-choices">${button("Уничтожить сеть", "ending", "destroy")}${button("Возглавить Хор", "ending", "control")}${button("Передать колонистам", "ending", "colonists")}</div>`}</div>${this.contractsMenu(s)}`;
      case "encounters":
        return `<div class="section-intro"><h3>Бортовая связь</h3><p>Сканируйте обломки и аномалии, чтобы принять сигнал. Патруль связывается при первом заходе в порт. Можно закрыть терминал и вернуться позже; выбор сохраняется сразу.</p></div>${
          s.encounters
            .filter((e) => e.resolved === null)
            .map((e) => {
              const def = encounterDefinitions[e.kind];
              return `<article class="story-card" data-encounter="${e.id}"><div class="eyebrow">${esc(generateGalaxy(s.seed)[e.system].name)} · ОТКРЫТЫЙ КАНАЛ</div><h3>${def.title}</h3><p>${def.text}</p>${button("К координатам сигнала", "encounterRoute", e.id)}<div class="list">${def.choices
                .map((c) => {
                  const reason = choiceUnavailable(s, e, c.id);
                  return `<div class="list-row"><div><strong>${c.title}</strong><p>${c.description}</p>${reason ? `<small>${reason}</small>` : ""}</div>${button("Ответить", "encounterChoice", `${e.id}|${c.id}`, !!reason)}</div>`;
                })
                .join("")}</div></article>`;
            })
            .join("") ||
          '<p class="muted">Открытых сигналов нет. Сканируйте контакты во время путешествия.</p>'
        }<h3 class="category-label">История решений</h3><div class="codex-entries">${
          s.encounters
            .filter((e) => e.resolved !== null)
            .slice()
            .reverse()
            .map((e) => `<article><p>${esc(e.result)}</p></article>`)
            .join("") || '<p class="muted">Вы ещё не отвечали на сигналы.</p>'
        }</div>`;
      case "tech":
        return `<div class="section-intro"><h3>Дерево технологий / ${s.upgrades.length} из ${upgrades.length}</h3><p>Покупка и установка доступны на станциях. Ветви открываются последовательно; дальние технологии требуют победы над стражами.</p></div>${[
          ...new Set(upgrades.map((u) => u.category)),
        ]
          .map(
            (category) =>
              `<h3 class="category-label">${category}</h3><div class="tech-grid">${upgrades
                .filter((u) => u.category === category)
                .map(
                  (u) =>
                    `<article class="tech-card ${s.upgrades.includes(u.id) ? "installed" : ""}"><div class="tech-top"><span>${u.region + 1} УРОВЕНЬ</span><b>${s.upgrades.includes(u.id) ? "✓" : "◇"}</b></div><h4>${u.name}</h4><p>${u.description}</p><small>${u.requires ? `Нужно: ${upgrades.find((x) => x.id === u.requires)?.name}` : "Базовая технология"}</small>${button(s.upgrades.includes(u.id) ? "Установлено" : `Установить · ₡ ${u.cost}`, "upgrade", u.id, s.upgrades.includes(u.id) || s.credits < u.cost || s.mode !== "station" || (s.physical ? !s.discovered.some((id) => Math.floor(id / 5) >= u.region) : s.bosses.length < u.region) || !!(u.requires && !s.upgrades.includes(u.requires)))}</article>`,
                )
                .join("")}</div>`,
          )
          .join("")}`;
      case "craft":
        return `<div class="section-intro"><h3>Производство</h3><p>Медотсек и верстак доступны внутри корабля и на станции. Мобильный верстак позволяет производить в поле.</p></div><div class="item-grid">${recipes
          .map(
            (r) =>
              `<article class="recipe-card"><div class="eyebrow">${r.station === "medbay" ? "МЕДОТСЕК" : "ФАБРИКАТОР"}</div><h4>${items[r.id].name} ×${r.amount}</h4><p>${Object.entries(
                r.cost,
              )
                .map(([id, n]) => `${items[id].name}: ${quantity(s, id)}/${n}`)
                .join(
                  " · ",
                )}</p>${button("Создать", "craft", r.id, (!has(s, "workbench") && !["station", "interior"].includes(s.mode)) || Object.entries(r.cost).some(([id, n]) => quantity(s, id) < n))}</article>`,
          )
          .join("")}</div>`;
      case "trade":
        return `<div class="section-intro"><h3>Рынок ${esc(sys.name)} · ₡ ${s.credits}</h3><p>${s.mode === "station" ? `${factions[faction]}. Репутация ${s.reputation[faction]}. Цены зависят от системы и отношения фракции.` : "Стыкуйтесь с портом для торговли."} Груз ${weight(s).toFixed(1)} / ${stats.cargo} кг.</p></div><div class="trade-list">${Object.entries(
          items,
        )
          .map(
            ([id, i]) =>
              `<div class="trade-row"><span class="trade-icon" style="color:${i.color}">${i.kind === "resource" ? "⬡" : i.kind === "medical" ? "✚" : "▣"}</span><div><strong>${i.name}</strong><small>Доступно: ${quantity(s, id)}</small></div>${button(`+1 · ₡ ${price(s, id, false, faction)}`, "buy", id, s.mode !== "station" || s.credits < price(s, id, false, faction))}${button(`−1 · ₡ ${price(s, id, true, faction)}`, "sell", id, s.mode !== "station" || !quantity(s, id))}</div>`,
          )
          .join("")}</div>`;
      case "codex":
        return `<div class="section-intro"><h3>Архив экспедиции</h3><p>Открыто ${s.discovered.length} систем · Добыто ${s.stats.mined} ресурсов · Побеждено ${s.stats.kills} врагов · ${s.stats.jumps} гиперпереходов</p></div><div class="codex-entries">${
          s.codex
            .slice()
            .reverse()
            .map(
              (entry, i) =>
                `<article><span>ЗАПИСЬ ${String(s.codex.length - i).padStart(3, "0")}</span><p>${esc(entry)}</p></article>`,
            )
            .join("") ||
          "<p>Сканирование и исследование руин автоматически пополняют архив.</p>"
        }</div><h3 class="category-label">Бортовой журнал</h3><div class="codex-entries">${s.chronicle
          .slice()
          .reverse()
          .map(
            (entry) =>
              `<article><small>День ${1 + Math.floor(entry.time / 1200)} / ${Math.floor(
                (entry.time % 1200) / 50,
              )
                .toString()
                .padStart(
                  2,
                  "0",
                )}:00 · ${esc(generateGalaxy(s.seed)[entry.system].name)}</small><p>${esc(entry.text)}</p></article>`,
          )
          .join(
            "",
          )}</div><h3 class="category-label">Последние сообщения</h3><div class="codex-entries">${s.logs.map((entry) => `<article><p>${esc(entry)}</p></article>`).join("")}</div>`;
      case "settings":
        return `<div class="section-intro"><h3>Параметры экспедиции</h3><p>Сохранения локальны для браузера и адреса сайта. Автосохранение каждые 30 секунд и при смене локации. Три независимых слота.</p></div><div class="settings-grid">${[
          ["sfx", "Громкость эффектов", 0, 1, 0.05],
          ["music", "Громкость фона", 0, 1, 0.05],
          ["uiScale", "Масштаб интерфейса", 0.7, 1.5, 0.1],
          ["stickSize", "Размер стиков", 70, 180, 10],
          ["opacity", "Прозрачность управления", 0.2, 1, 0.1],
          ["sensitivity", "Чувствительность", 0.5, 2, 0.1],
        ]
          .map(
            ([key, label, min, max, step]) =>
              `<label>${label}<input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${s.settings[key as keyof State["settings"]]}"/></label>`,
          )
          .join(
            "",
          )}<label class="checkbox"><input type="checkbox" data-setting="mute" ${s.settings.mute ? "checked" : ""}/>Без звука</label><label class="checkbox"><input type="checkbox" data-setting="reduced" ${s.settings.reduced ? "checked" : ""}/>Меньше эффектов</label></div><div class="save-management">${button("Сохранить в текущий слот", "save")}${button("Экспорт JSON", "export")}${button("Импорт JSON", "import")}${button("Главное меню", "menu")}</div><p class="muted">Активный слот: ${s.slot + 1}. Перед выходом игра сохраняется автоматически. Браузер может ограничивать хранилище в приватном режиме.</p>${import.meta.env.DEV ? `<h3>Development tools</h3><div class="save-management">${["heal", "credits", "map", "damage", "boss", "upgrades"].map((id) => button(id, "debug", id)).join("")}</div>` : ""}`;
      case "help":
        return `<div class="help-grid"><article><h3>Движение и бой</h3><p>WASD / стрелки — движение. Shift — форсаж. X — тормоз. Пробел или правая кнопка мыши — огонь. Мышь задаёт направление выстрела. E — ближайшее действие. R — сканер. G — карта. I — груз. M — медицина. Esc — закрыть меню.</p><p>На телефоне левый стик двигает, правый наводит и стреляет. Крупные кнопки выполняют действия.</p></article><article><h3>Навигация</h3><p>Нажмите на объект в игровом мире или выберите контакт на карте: корабль подлетит сам. Порт требует скорости ниже 45 м/с и носа налево. Автопилот выполняет выравнивание. После остановки нажмите «Стыковка».</p><p>На планете нажмите на ресурс или руины для подхода, затем взаимодействуйте. Для взлёта вернитесь к посадочному модулю.</p></article><article><h3>Выживание</h3><p>Откройте груз, чтобы заправиться, пополнить патроны и кислород. Медицинский сканер позволяет выбрать раненую часть тела. Бинты останавливают кровь, хирургический набор восстанавливает ткани.</p><p>Внутри корабля почините аварийный отсек ремкомплектом. На станции доступно платное полное обслуживание. Если корабль обездвижен без топлива, аварийный маяк вызовет эвакуацию.</p>${button("Аварийная эвакуация", "rescue")}</article><article><h3>Кампания</h3><p>Посетите порт, затем найдите Архив Хора на планете первого региона. В журнале появится вызов стража. Победа открывает следующий регион. Улучшайте корабль между боями. Расследование — один из возможных путей. Зарабатывать, исследовать и жить в Пределе можно без побед над стражами.</p><p>Корабли восстанавливают щит со временем. Ракеты и рельсотрон помогают пробить поздних боссов. Их атаки ускоряются при потере корпуса.</p></article></div>`;
      default:
        return "";
    }
  }
}
