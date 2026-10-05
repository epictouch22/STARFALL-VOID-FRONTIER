import "./ui/style.css";
import { Interface } from "./ui/interface";
import { Renderer } from "./scenes/renderer";
import { Controller } from "./input/controller";
import { SoundManager } from "./audio/sound";
import {
  newGame,
  addItem,
  consume,
  has,
  healthy,
  log,
  shipStats,
} from "./core/state";
import { tick } from "./core/simulation";
import {
  interact,
  scan,
  jump,
  nearest,
  contacts,
  currentPlanet,
  launchBoss,
  chooseEnding,
  recover,
  useSupply,
  populateEnemies,
  boardOwnShip,
} from "./core/actions";
import {
  trade,
  craft,
  recycleItem,
  buyUpgrade,
  buyShip,
  serviceShip,
  equipWeapon,
  acceptContract,
  cancelContract,
  missionTarget,
  claimContract,
} from "./core/economy";
import { treat } from "./core/medicine";
import { save, load, decode, exportSave } from "./save/storage";
import { generateGalaxy, generateSurface } from "./world/galaxy";
import { upgrades } from "./data/catalog";
import { items } from "./data/catalog";
import { transfer, unloadResources } from "./core/inventory";
import { resolveEncounter } from "./core/encounters";
import { requestDock, berth, releaseDock, emptyDock } from "./core/docking";
import {
  activeResidents,
  talkResident,
  serviceAvailable,
} from "./core/residents";
import type { State } from "./core/types";
let state: State = newGame(),
  playing = false,
  hidden = false;
let last = performance.now(),
  accumulator = 0,
  hudClock = 0,
  saveClock = 0;
let walkingRoute: { x: number; y: number }[] = [];
const sound = new SoundManager();
const ui = new Interface(() => state, action);
let renderer = new Renderer(
  document.getElementById("world") as HTMLCanvasElement,
  state.seed,
);
const input = new Controller(
  renderer.canvas,
  (x, y) => renderer.worldAt(x, y),
  () => state,
  keyAction,
  () => state.settings.sensitivity,
);
input.attach();
ui.landing();
window.addEventListener("resize", () => renderer.resize());
function persist(manual = false) {
  if (!playing) return;
  try {
    save(state);
    ui.saved();
    if (manual) ui.toast("Игра сохранена в слот " + (state.slot + 1));
  } catch (e) {
    ui.toast("Не удалось сохранить: " + String(e));
  }
}
function start(s: State) {
  state = s;
  playing = true;
  input.reset();
  input.enabled = true;
  renderer = new Renderer(renderer.canvas, state.seed);
  ui.start();
  sound.init();
  sound.settings(state.settings.mute, state.settings.music);
  persist();
}
function close() {
  walkingRoute = [];
  ui.close();
  input.reset();
  input.enabled = playing;
}
function open(panel: string) {
  walkingRoute = [];
  input.reset();
  input.enabled = false;
  ui.open(panel);
}
function navigate(id: string) {
  let target: { x: number; y: number; dock?: boolean } | undefined;
  if (state.mode === "station" && state.physical) {
    if (id === "station-airlock") target = { x: 0, y: 440 };
    else if (id === "ship-airlock") target = { x: 0, y: 270 };
    else
      target = activeResidents(state).find((n) => n.id === id || n.role === id);
    if (!target) target = state.ship.modules.find((m) => m.id === id);
  } else if (state.mode === "interior")
    target = state.ship.modules.find((m) => m.id === id);
  else if (state.mode === "space") {
    const c = contacts(state).find((c) => c.id === id);
    if (c)
      target = {
        x:
          c.x +
          (c.kind === "station" || c.kind === "outpost"
            ? c.radius + (state.physical ? 48 : 70)
            : c.kind === "planet"
              ? c.radius + 70
              : 0),
        y: c.y,
        dock: c.kind === "station" || c.kind === "outpost",
      };
  }
  if (target) {
    close();
    if (
      state.mode === "station" &&
      state.physical &&
      Math.abs(target.y - state.y) > 30
    ) {
      const blocked =
        !state.docking.stationDoor && state.y < 480 && target.y > 480;
      walkingRoute = [
        { x: 0, y: state.y },
        { x: 0, y: blocked ? 440 : target.y },
        ...(blocked ? [] : [{ x: target.x, y: target.y }]),
      ];
      input.controls.target = walkingRoute.shift()!;
    } else input.controls.target = target;
    input.controls.aim = null;
    ui.toast("Автопилот включён. Движение стиком или WASD отменяет маршрут.");
  }
}
function action(name: string, param = "") {
  sound.init();
  if (!state.settings.mute) sound.play("click", state.settings.sfx);
  switch (name) {
    case "slot":
      ui.activeSlot = Number(param);
      ui.landing();
      return;
    case "new": {
      const seed =
          (
            document.getElementById("world-seed") as HTMLInputElement
          ).value.trim() || "STARFALL",
        name =
          (
            document.getElementById("pilot-name") as HTMLInputElement
          ).value.trim() || "Пилот";
      start(newGame(seed, Number(param), name));
      return;
    }
    case "continue":
      try {
        const s = load(Number(param));
        if (s) start(s);
      } catch (e) {
        ui.toast(String(e));
      }
      return;
    case "menu":
      persist();
      playing = false;
      input.enabled = false;
      input.reset();
      sound.suspend();
      ui.landing();
      return;
    case "panel":
      open(param);
      return;
    case "close":
      close();
      return;
    case "requestDock":
      if (requestDock(state, param)) persist();
      ui.toast(state.logs[0]);
      break;
    case "releaseDock":
      if (releaseDock(state)) persist();
      ui.toast(state.logs[0]);
      break;
    case "cancelDock":
      if (state.docking.phase === "requested") {
        state.docking = emptyDock();
        persist();
        ui.toast("Запрос причала отменён.");
      }
      break;
    case "askLore":
      talkResident(state, param, true);
      persist();
      ui.toast(state.logs[0]);
      break;
    case "save":
      persist(true);
      return;
    case "export":
      exportSave(state);
      ui.toast("Резервная копия экспортирована");
      return;
    case "import":
      (document.getElementById("import-file") as HTMLInputElement).click();
      return;
    case "interact": {
      const old = state.mode;
      const panel = interact(state);
      input.controls.target = null;
      if (old !== state.mode) {
        input.reset();
        if (state.mode === "surface") {
          const p = currentPlanet(state)!;
          state.enemies = Array.from(
            { length: 2 + Math.floor(state.system / 5) },
            (_, i) => ({
              id: `${p.id}-animal-${i}`,
              name: "Хищник",
              x: 650 - i * 140,
              y: -400 - i * 70,
              vx: 0,
              vy: 0,
              angle: 0,
              hp: 35 + state.system * 2,
              maxHp: 35 + state.system * 2,
              shield: 0,
              cooldown: 2,
              kind: "predator",
              phase: 0,
              disabled: 0,
              boss: false,
            }),
          ).filter((e) => !state.kills.includes(e.id));
        }
        if (state.mode === "space" && old !== "interior")
          populateEnemies(state);
        persist();
      }
      if (state.physical) persist();
      if (panel) open(panel);
      else ui.toast(state.logs[0]);
      break;
    }
    case "scan":
      scan(state);
      persist();
      if (!state.settings.mute) sound.play("scan", state.settings.sfx);
      ui.toast(state.logs[0]);
      break;
    case "encounterChoice": {
      const [id, choice] = param.split("|");
      if (resolveEncounter(state, id, choice)) persist();
      ui.toast(state.logs[0]);
      break;
    }
    case "encounterRoute": {
      const e = state.encounters.find(
        (e) => e.id === param && e.resolved === null,
      );
      if (!e) break;
      if (e.system !== state.system) {
        ui.selectedSystem = e.system;
        open("galaxy");
      } else if (state.mode === "space") {
        close();
        input.controls.target = { x: e.x, y: e.y };
        input.controls.aim = null;
      } else ui.toast("Сначала сядьте за штурвал и покиньте порт.");
      break;
    }
    case "autopilot": {
      const n = nearest(state);
      if (n) {
        if (state.mode === "space") navigate(n.id);
        else {
          close();
          input.controls.target = { x: n.x, y: n.y };
        }
      }
      break;
    }
    case "navigate":
      navigate(param);
      break;
    case "board":
      if (state.mode === "surface") {
        close();
        input.controls.target = { x: 0, y: 0 };
        ui.toast(
          "Возвращение к посадочному модулю. После прибытия нажмите действие для взлёта.",
        );
        break;
      }
      if (state.mode === "space") {
        boardOwnShip(state);
        input.reset();
      } else if (state.mode === "eva") {
        if (
          Math.hypot(state.x - state.orbit.x, state.y - state.orbit.y) > 150
        ) {
          ui.toast("Подлетите к кораблю (0, 0) для входа в шлюз.");
          return;
        }
        state.mode = "interior";
        state.x = 0;
        state.y = 260;
        input.reset();
      } else if (state.mode === "derelict") {
        state.mode = "space";
        state.x = state.orbit.x;
        state.y = state.orbit.y;
        unloadResources(state);
        state.location = "";
        input.reset();
        populateEnemies(state);
      }
      persist();
      break;
    case "jump":
      if (jump(state, Number(param))) {
        close();
        input.reset();
        if (!state.settings.mute) sound.play("jump", state.settings.sfx);
        persist();
      } else ui.toast(state.logs[0]);
      break;
    case "selectSystem":
      ui.selectedSystem = Number(param);
      ui.refresh();
      return;
    case "body":
      ui.medicalPart = Number(param);
      ui.refresh();
      return;
    case "treat":
      ui.toast(
        treat(state, param, ui.medicalPart)
          ? "Лечение выполнено"
          : "Нет подходящего ранения или препарата.",
      );
      break;
    case "use":
      if (useSupply(state, param)) ui.toast("Припасы использованы");
      break;
    case "quick": {
      const id = state.quickSlots[Number(param)];
      if (!id) return;
      if (items[id].kind === "medical") {
        const wounded = state.health.parts.findIndex(
          (p) => Object.keys(p.wounds).length || p.health < 100,
        );
        ui.toast(
          treat(state, id, wounded < 0 ? ui.medicalPart : wounded)
            ? "Лечение выполнено"
            : "Нет подходящего ранения",
        );
      } else if (!useSupply(state, id))
        ui.toast("Припас не нужен или отсутствует.");
      break;
    }
    case "quickAssign": {
      const index = ui.quickIndex;
      state.quickSlots[index] = param;
      ui.quickIndex = (index + 1) % 4;
      ui.toast(`Назначено в быстрый слот ${index + 1}`);
      break;
    }
    case "transfer": {
      const [dest, id] = param.split(":");
      ui.toast(
        transfer(state, id, dest === "pack")
          ? "Предмет перемещён"
          : "Нет места или доступа к кораблю",
      );
      break;
    }
    case "avatar": {
      for (const key of ["skin", "suit", "hair"] as const)
        state.avatar[key] = (
          document.getElementById(`avatar-${key}`) as HTMLInputElement
        ).value;
      state.avatar.style = Number(
        (document.getElementById("avatar-style") as HTMLSelectElement).value,
      );
      state.avatar.helmet = (
        document.getElementById("avatar-helmet") as HTMLInputElement
      ).checked;
      ui.toast("Персонаж обновлён");
      break;
    }
    case "discard":
      {
        const [pool, id] = param.split(":");
        const target = pool === "pack" ? state.pack : state.inventory;
        if (target[id] > 0) {
          target[id]--;
          if (!target[id]) delete target[id];
        }
      }
      break;
    case "recycle":
      ui.toast(
        recycleItem(state, param)
          ? state.logs[0]
          : "Не хватает места или предмет нельзя разобрать.",
      );
      break;
    case "craft":
      ui.toast(
        craft(state, param)
          ? "Производство завершено"
          : "Недостаточно ресурсов, грузового места или доступа к верстаку.",
      );
      break;
    case "buy":
    case "sell":
      ui.toast(
        trade(
          state,
          param,
          1,
          name === "sell",
          contacts(state).find((c) => c.id === state.location)?.faction ?? 0,
        )
          ? "Сделка завершена"
          : "Сделка недоступна: проверьте кредитный баланс и груз.",
      );
      break;
    case "upgrade":
      ui.toast(
        buyUpgrade(state, param)
          ? "Модуль установлен"
          : "Установка сейчас недоступна.",
      );
      break;
    case "buyShip":
      ui.toast(
        buyShip(state, param) ? "Корабль приобретён" : "Покупка недоступна.",
      );
      break;
    case "weapon":
      if (equipWeapon(state, param)) {
        ui.toast("Оружие переключено");
      }
      break;
    case "accept": {
      ui.toast(
        acceptContract(state, param)
          ? state.logs[0]
          : "Недостаточно места для контрактного груза.",
      );
      persist();
      break;
    }
    case "cancelContract":
      if (cancelContract(state, param)) {
        ui.toast(state.logs[0]);
        persist();
      }
      break;
    case "missionRoute": {
      const q = state.contracts.find((q) => q.id === param);
      const target = q && missionTarget(q);
      if (target) {
        if (target.system === state.system && state.mode === "space")
          navigate(target.location);
        else {
          ui.selectedSystem = target.system;
          open("galaxy");
        }
      }
      return;
    }
    case "claim":
      ui.toast(
        claimContract(state, param)
          ? "Контракт сдан. Награда получена."
          : "Условия контракта ещё не выполнены.",
      );
      persist();
      break;
    case "boss":
      if (launchBoss(state)) {
        close();
        input.reset();
        ui.toast(state.logs[0]);
        persist();
      }
      break;
    case "ending":
      if (chooseEnding(state, param)) {
        ui.toast(state.logs[0]);
        persist();
      }
      break;
    case "service":
      if (serviceShip(state)) {
        persist();
        if (state.physical) close();
        ui.toast(state.logs[0]);
      }
      break;
    case "clinic":
      if (
        state.physical &&
        serviceAvailable(state, "medical") &&
        state.credits >= 120
      ) {
        const n = activeResidents(state).find((n) => n.role === "medical")!;
        state.activity = {
          operation: "clinic",
          target: n.id,
          mode: state.mode,
          system: state.system,
          location: state.location,
          x: n.x,
          y: n.y,
          elapsed: 0,
          duration: 10,
          label: "Врач проводит лечение",
        };
        close();
        ui.toast("Останьтесь возле врача на 10 секунд.");
        persist();
      } else if (
        !state.physical &&
        state.mode === "station" &&
        state.credits >= 120
      ) {
        state.credits -= 120;
        state.health = healthy();
        ui.toast("Полное лечение выполнено");
      }
      break;
    case "customize": {
      const name = (
        document.getElementById("ship-name") as HTMLInputElement
      ).value.trim();
      if (name) state.ship.name = name;
      state.ship.color = (
        document.getElementById("ship-color") as HTMLInputElement
      ).value;
      state.ship.accent = (
        document.getElementById("ship-accent") as HTMLInputElement
      ).value;
      ui.toast("Внешний вид обновлён");
      break;
    }
    case "rescue":
      recover(state);
      close();
      input.reset();
      persist();
      break;
    case "debug":
      if (import.meta.env.DEV) {
        if (param === "heal") {
          state.health = healthy();
          state.ship.hull = shipStats(state).hull;
          state.ship.fuel = 100;
          state.ship.ammo = 1000;
        }
        if (param === "credits") state.credits += 10000;
        if (param === "map")
          state.discovered = generateGalaxy(state.seed).map((x) => x.id);
        if (param === "damage") {
          state.ship.hull *= 0.5;
          state.ship.modules[1].breach = true;
          state.health.parts[2].health = 35;
          state.health.parts[2].wounds.fracture = 30;
        }
        if (param === "boss") {
          state.mode = "space";
          state.system = state.chapter * 5;
          state.evidence.push(state.chapter);
          launchBoss(state);
          close();
        }
        if (param === "upgrades") {
          state.upgrades = upgrades.map((x) => x.id);
          state.ship.hull = shipStats(state).hull;
        }
      }
      break;
  }
  ui.refresh();
  sound.settings(state.settings.mute, state.settings.music);
}
function keyAction(key: string) {
  if (/^Digit[1-4]$/.test(key)) {
    action("quick", String(Number(key.slice(-1)) - 1));
    return;
  }
  if (key.startsWith("target:")) {
    const [, xs, ys] = key.split(":"),
      p = { x: Number(xs), y: Number(ys) };
    if (state.mode === "space") {
      const candidate = contacts(state).find(
        (c) => Math.hypot(c.x - p.x, c.y - p.y) < c.radius + 55,
      );
      if (candidate) {
        navigate(candidate.id);
        return;
      }
    } else if (state.mode === "surface") {
      const planet = currentPlanet(state);
      const candidate =
        planet &&
        generateSurface(state.seed, planet).find(
          (n) => Math.hypot(n.x - p.x, n.y - p.y) < 60,
        );
      if (candidate) {
        input.controls.target = { x: candidate.x, y: candidate.y };
        return;
      }
    }
    input.controls.target = p;
    input.controls.aim = null;
    return;
  }
  const actions: Record<string, [string, string]> = {
    KeyE: ["interact", ""],
    KeyR: ["scan", ""],
    KeyG: ["panel", "galaxy"],
    KeyI: ["panel", "inventory"],
    KeyM: ["panel", "medical"],
    KeyJ: ["panel", "quests"],
    KeyP: ["panel", "settings"],
  };
  if (actions[key]) action(...actions[key]);
}
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && playing) {
    e.preventDefault();
    if (ui.panel) close();
    else open("settings");
  }
});
document.getElementById("modal")!.addEventListener("click", (e) => {
  const group = (e.target as Element).closest<SVGElement>("[data-system]");
  if (group) action("selectSystem", group.dataset.system!);
});
document.getElementById("modal")!.addEventListener("keydown", (e) => {
  const group = (e.target as Element).closest<SVGElement>("[data-system]");
  if (group && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    action("selectSystem", group.dataset.system!);
  }
});
document.addEventListener("input", (e) => {
  const node = e.target as HTMLInputElement;
  const key = node.dataset.setting as keyof State["settings"];
  if (!key) return;
  (state.settings as unknown as Record<string, number | boolean>)[key] =
    node.type === "checkbox" ? node.checked : Number(node.value);
  ui.update();
  sound.settings(state.settings.mute, state.settings.music);
});
document
  .getElementById("customize-form")
  ?.addEventListener("submit", (e) => e.preventDefault());
document.addEventListener("submit", (e) => e.preventDefault());
document
  .getElementById("import-file")!
  .addEventListener("change", async (e) => {
    const node = e.target as HTMLInputElement,
      file = node.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4e6) throw new Error("Файл слишком большой");
      const imported = decode(await file.text());
      imported.slot = playing ? state.slot : ui.activeSlot;
      start(imported);
      ui.toast("Сохранение импортировано");
    } catch (e) {
      ui.toast(String(e));
    } finally {
      node.value = "";
    }
  });
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  if (hidden) {
    persist();
    input.reset();
    sound.suspend();
  } else {
    last = performance.now();
    accumulator = 0;
    if (playing) sound.resume();
  }
});
window.addEventListener("pagehide", () => persist());
function frame(now: number) {
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing && !ui.panel && !hidden) {
    input.update();
    if (Math.hypot(input.controls.mx, input.controls.my) > 0.1)
      walkingRoute = [];
    if (!input.controls.target && walkingRoute.length)
      input.controls.target = walkingRoute.shift()!;
    accumulator += delta;
    while (accumulator >= 1 / 60) {
      const cooldown = state.cooldown;
      tick(state, input.controls, 1 / 60);
      if (state.cooldown > cooldown && !state.settings.mute)
        sound.play("shot", state.settings.sfx);
      accumulator -= 1 / 60;
    }
    hudClock += delta;
    saveClock += delta;
    if (hudClock > 0.2) {
      ui.update();
      hudClock = 0;
    }
    if (saveClock > 30) {
      persist();
      saveClock = 0;
    }
  } else if (!playing) state.time += delta;
  renderer.draw(state, input.controls, playing);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
