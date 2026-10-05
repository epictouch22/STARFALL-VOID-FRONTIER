import { it, expect } from "vitest";
import {
  legacyGame as newGame,
  addItem,
  quantity,
  shipStats,
} from "../src/core/state";
import {
  inventoryWeight,
  transfer,
  unloadResources,
} from "../src/core/inventory";
import { decode, validateState } from "../src/save/storage";
import { hash } from "../src/world/galaxy";
import {
  boardDerelict,
  externalRepair,
  salvageBoard,
} from "../src/core/boarding";
import { enterSpace, launchBoss, interact } from "../src/core/actions";
import { tick, type Controls } from "../src/core/simulation";
import { buyShip, craft } from "../src/core/economy";
const idle = (): Controls => ({
  mx: 0,
  my: 0,
  aim: null,
  fire: false,
  boost: false,
  brake: false,
  target: null,
});
it("the intro remains completable if modules are repaired out of order", () => {
  const s = newGame();
  s.x = 150;
  s.y = 150;
  interact(s);
  s.x = -150;
  s.y = 0;
  interact(s);
  s.x = 150;
  interact(s);
  expect(s.intro).toBe(1);
  s.x = 0;
  s.y = 260;
  interact(s);
  s.x = -150;
  s.y = 0;
  interact(s);
  s.x = 150;
  interact(s);
  expect(s.intro).toBe(4);
  s.x = 0;
  s.y = -150;
  interact(s);
  expect(s.mode).toBe("space");
});
it("migrates a version 1 published save while preserving all existing progress", () => {
  const s = newGame("legacy", 2);
  s.credits = 1234;
  const old = JSON.parse(JSON.stringify(s));
  old.version = 1;
  delete old.avatar;
  delete old.pack;
  delete old.quickSlots;
  const payload = JSON.stringify(old);
  const migrated = decode(
    JSON.stringify({
      format: "STARFALL",
      saveVersion: 1,
      checksum: hash(payload),
      payload,
    }),
  );
  expect(migrated.version).toBe(5);
  expect(migrated.credits).toBe(1234);
  expect(migrated.slot).toBe(2);
  expect(migrated.pack).toEqual({});
  expect(validateState(migrated)).toBe(true);
});
it("separates cargo and suit capacities, transfers items and unloads resources", () => {
  const s = newGame();
  expect(transfer(s, "iron", true, 5)).toBe(true);
  expect(s.inventory.iron).toBe(3);
  expect(s.pack.iron).toBe(5);
  s.mode = "surface";
  expect(addItem(s, "iron", 50)).toBe(false);
  expect(addItem(s, "iron", 2)).toBe(true);
  expect(transfer(s, "iron", false)).toBe(false);
  s.mode = "space";
  unloadResources(s);
  expect(s.pack.iron).toBeUndefined();
  expect(s.inventory.iron).toBe(10);
  expect(inventoryWeight(s.pack)).toBeLessThan(35);
  expect(quantity(s, "oxygen")).toBe(4);
});
it("rolls back both containers if a mobile workbench output does not fit", () => {
  const s = newGame();
  s.mode = "surface";
  s.upgrades = ["cargo-4"];
  s.pack = { gold: 35 };
  const inventory = { ...s.inventory },
    pack = { ...s.pack };
  expect(craft(s, "parts")).toBe(false);
  expect(s.inventory).toEqual(inventory);
  expect(s.pack).toEqual(pack);
});
it("ship classes actually add rooms and preserve valid saves", () => {
  const s = newGame();
  s.mode = "station";
  s.credits = 10000;
  expect(buyShip(s, "explorer")).toBe(true);
  expect(s.ship.modules).toHaveLength(8);
  expect(buyShip(s, "corvette")).toBe(true);
  expect(s.ship.modules).toHaveLength(10);
  expect(s.ship.modules.some((m) => m.id === "shield")).toBe(true);
  expect(validateState(s)).toBe(true);
});
it("EVA repair consumes parts and seals a real breach near the parked ship", () => {
  const s = newGame();
  s.mode = "eva";
  s.orbit = { x: 400, y: 200, angle: 0, active: true };
  s.x = 410;
  s.y = 200;
  const before = quantity(s, "parts");
  expect(externalRepair(s)).toBe(true);
  expect(quantity(s, "parts")).toBe(before - 1);
  expect(s.ship.modules.some((m) => m.breach)).toBe(false);
  s.x = 1000;
  expect(externalRepair(s)).toBe(false);
});
it("derelict crew can be defeated by projectiles before salvage, once only", () => {
  const s = newGame();
  s.intro = 4;
  s.ship.modules.forEach((m) => {
    m.integrity = 100;
    m.breach = false;
  });
  boardDerelict(s, "board:test");
  expect(salvageBoard(s)).toBe(false);
  for (let i = 0; i < 3600 && s.enemies.length && s.mode === "derelict"; i++) {
    const e = s.enemies[0];
    tick(
      s,
      { ...idle(), fire: true, aim: Math.atan2(e.y - s.y, e.x - s.x) },
      1 / 60,
    );
  }
  expect(s.mode).toBe("derelict");
  expect(s.enemies).toHaveLength(0);
  for (let i = 0; i < 150; i++)
    tick(s, { ...idle(), target: { x: 0, y: 0 } }, 1 / 60);
  expect(salvageBoard(s)).toBe(true);
  const credits = s.credits;
  expect(salvageBoard(s)).toBe(false);
  expect(s.credits).toBe(credits);
  expect(s.pack.exo).toBe(2);
  expect(validateState(s)).toBe(true);
});
it("all five phased bosses can actually be defeated through collision-based combat", () => {
  const s = newGame();
  s.intro = 4;
  s.ship.modules.forEach((m) => {
    m.integrity = 100;
    m.breach = false;
  });
  s.ship.class = "corvette";
  s.upgrades = [
    "shield-0",
    "shield-1",
    "hull-0",
    "hull-1",
    "weapon-0",
    "weapon-1",
    "weapon-2",
    "weapon-6",
  ];
  s.ship.weapon = "rail";
  s.ship.ammo = 200;
  s.eventClock = 100000;
  enterSpace(s);
  for (let chapter = 0; chapter < 5; chapter++) {
    s.system = chapter * 5;
    s.evidence.push(chapter);
    s.ship.hull = shipStats(s).hull;
    s.ship.shield = shipStats(s).shield;
    s.ship.energy = shipStats(s).energy;
    s.x = 0;
    s.y = 0;
    expect(launchBoss(s)).toBe(true);
    const phases = new Set<number>();
    for (let i = 0; i < 7200 && s.enemies.length && s.mode === "space"; i++) {
      const e = s.enemies[0];
      phases.add(e.phase);
      tick(
        s,
        { ...idle(), fire: true, aim: Math.atan2(e.y - s.y, e.x - s.x) },
        1 / 60,
      );
    }
    expect(s.mode).toBe("space");
    expect(s.chapter).toBe(chapter + 1);
    expect(phases.has(2)).toBe(true);
    expect(phases.has(3)).toBe(true);
    expect(validateState(s)).toBe(true);
  }
});
