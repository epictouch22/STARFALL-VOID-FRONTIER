import { describe, it, expect } from "vitest";
import { newGame, addItem, consume, quantity, weight } from "../src/core/state";
import { canUseSupply, useSupply } from "../src/core/actions";
import { recycleItem } from "../src/core/economy";
import {
  acceptContract,
  claimContract,
  contractOffers,
  canAcceptContract,
  cancelContract,
  trade,
  buyShip,
  price,
  rescueCrew,
} from "../src/core/economy";
import { inventorySlots, reservedCargo, transfer } from "../src/core/inventory";
import { boardDerelict, salvageBoard } from "../src/core/boarding";
import { tick, type Controls } from "../src/core/simulation";
import { encode, decode, validateState } from "../src/save/storage";
import { hash, generateGalaxy } from "../src/world/galaxy";
import { medicalTick, treat } from "../src/core/medicine";
const idle = (): Controls => ({
  mx: 0,
  my: 0,
  aim: null,
  fire: false,
  boost: false,
  brake: false,
  target: null,
});
function atPort(system = 0, location = `${system}-s`) {
  const s = newGame();
  s.mode = "station";
  s.system = system;
  s.location = location;
  return s;
}
function oldSave(value: unknown, version: number) {
  const payload = JSON.stringify(value);
  return JSON.stringify({
    format: "STARFALL",
    saveVersion: version,
    payload,
    checksum: hash(payload),
  });
}
describe("cross-system missions", () => {
  it("issues a sealed manifest, keeps personal medicine, reveals route and refuses the wrong port", () => {
    const s = atPort(),
      before = weight(s),
      meds = quantity(s, "medkit");
    expect(acceptContract(s, "0-delivery")).toBe(true);
    expect(weight(s)).toBe(before + 2);
    expect(quantity(s, "medkit")).toBe(meds);
    expect(claimContract(s, "0-delivery")).toBe(false);
    const q = s.contracts[0];
    expect(q.mission?.destination).toEqual({ system: 1, location: "1-s" });
    expect(s.scanned).toContain("1-s");
    expect(s.discovered).toContain(1);
    expect(acceptContract(s, "0-delivery")).toBe(false);
    expect(consume(s, "medkit", meds)).toBe(true);
    expect(trade(s, "medkit", 1, true, 0)).toBe(false);
    expect(reservedCargo(s).weight).toBe(2);
    s.system = 1;
    s.location = "1-o";
    expect(claimContract(s, q.id)).toBe(false);
    s.location = "1-s";
    const credits = s.credits,
      reputation = s.reputation[0];
    expect(claimContract(s, q.id)).toBe(true);
    expect(s.credits).toBe(credits + 450);
    expect(s.reputation[0]).toBe(reputation + 8);
    expect(reservedCargo(s).weight).toBe(0);
    expect(claimContract(s, q.id)).toBe(false);
  });
  it("enforces reserved cargo weight during purchases, transfers and ship changes", () => {
    const s = atPort();
    s.inventory = { gold: 97 };
    s.pack = { iron: 2 };
    s.credits = 10000;
    expect(acceptContract(s, "0-delivery")).toBe(true);
    expect(addItem(s, "iron", 2, false)).toBe(false);
    expect(transfer(s, "iron", false, 2)).toBe(false);
    expect(trade(s, "iron", 2, false, 0)).toBe(false);
    expect(s.inventory.gold).toBe(97);
    expect(s.pack.iron).toBe(2);
    expect(buyShip(s, "freighter")).toBe(true);
    expect(addItem(s, "iron", 4, false)).toBe(true);
    const balance = s.credits;
    expect(buyShip(s, "shuttle")).toBe(false);
    expect(s.credits).toBe(balance);
    expect(s.ship.class).toBe("freighter");
  });
  it("refuses acceptance when either weight or slots are full, without changing state", () => {
    const s = atPort();
    s.inventory = { gold: 99 };
    const snapshot = structuredClone(s);
    expect(acceptContract(s, "0-delivery")).toBe(false);
    expect(s).toEqual(snapshot);
    s.inventory = { bandage: 99 * 40 };
    s.ship.class = "freighter";
    s.upgrades = ["cargo-0", "cargo-1", "cargo-2", "cargo-3"];
    // A lightweight synthetic stack fixture isolates the slot constraint independently.
    const offer = contractOffers(s).find((q) => q.type === "delivery")!;
    expect(inventorySlots(s.inventory)).toBe(40);
    expect(canAcceptContract(s, offer)).toBe(false);
  });
  it("delivers passengers only at their destination and releases reserved capacity", () => {
    const s = atPort();
    expect(acceptContract(s, "0-passenger")).toBe(true);
    expect(reservedCargo(s)).toEqual({ weight: 12, slots: 2 });
    expect(claimContract(s, "0-passenger")).toBe(false);
    s.system = 1;
    s.location = "1-s";
    expect(claimContract(s, "0-passenger")).toBe(true);
    expect(reservedCargo(s)).toEqual({ weight: 0, slots: 0 });
    expect(validateState(s)).toBe(true);
  });
  it("allows cancellation only at a port, penalizes once and prevents repeat acceptance/rewards", () => {
    const s = atPort();
    acceptContract(s, "0-passenger");
    const credits = s.credits;
    s.mode = "space";
    expect(cancelContract(s, "0-passenger")).toBe(false);
    s.mode = "station";
    expect(cancelContract(s, "0-passenger")).toBe(true);
    expect(cancelContract(s, "0-passenger")).toBe(false);
    expect(s.reputation[0]).toBe(-4);
    expect(acceptContract(s, "0-passenger")).toBe(false);
    expect(claimContract(s, "0-passenger")).toBe(false);
    expect(reservedCargo(s).weight).toBe(0);
    expect(s.credits).toBe(credits);
    expect(validateState(s)).toBe(true);
  });
  it("requires actual boarding, living guards to be defeated, terminal proximity and return to origin", () => {
    const s = atPort();
    acceptContract(s, "0-rescue");
    s.intro = 4;
    s.ship.modules.forEach((m) => {
      m.integrity = 100;
      m.breach = false;
    });
    s.system = 1;
    boardDerelict(s, "1-c0");
    expect(rescueCrew(s)).toBe(false);
    for (
      let i = 0;
      i < 3600 && s.enemies.length && s.mode === "derelict";
      i++
    ) {
      const e = s.enemies[0];
      tick(
        s,
        { ...idle(), fire: true, aim: Math.atan2(e.y - s.y, e.x - s.x) },
        1 / 60,
      );
    }
    expect(s.enemies).toHaveLength(0);
    expect(rescueCrew(s)).toBe(false);
    for (let i = 0; i < 150; i++)
      tick(s, { ...idle(), target: { x: 0, y: 0 } }, 1 / 60);
    expect(salvageBoard(s)).toBe(true);
    expect(s.contracts[0].mission?.stage).toBe("delivery");
    expect(rescueCrew(s)).toBe(false);
    expect(salvageBoard(s)).toBe(false);
    const restored = decode(encode(s));
    expect(restored.contracts[0].mission?.stage).toBe("delivery");
    restored.mode = "station";
    restored.location = "1-s";
    expect(claimContract(restored, "0-rescue")).toBe(false);
    restored.system = 0;
    restored.location = "0-s";
    expect(claimContract(restored, "0-rescue")).toBe(true);
    expect(claimContract(restored, "0-rescue")).toBe(false);
    expect(validateState(restored)).toBe(true);
  });
  it("can rescue survivors even after the salvage cargo has already been collected", () => {
    const s = atPort();
    acceptContract(s, "0-rescue");
    s.mode = "derelict";
    s.system = 1;
    s.location = "1-c0";
    s.x = s.y = 0;
    s.depleted["1-c0-salvaged"] = 1;
    expect(salvageBoard(s)).toBe(true);
    expect(s.contracts[0].mission?.stage).toBe("delivery");
    expect(salvageBoard(s)).toBe(false);
  });
  it("does not count boarding guards as ship bounty kills", () => {
    const s = atPort();
    acceptContract(s, "0-hunt");
    boardDerelict(s, "1-c0");
    s.enemies[0].hp = 0;
    tick(s, idle(), 1 / 60);
    expect(s.contracts[0].progress).toBe(0);
  });
  it("offers reachable routes in all 25 systems and remembers the actual outpost of acceptance", () => {
    for (let system = 0; system < 25; system++) {
      const s = atPort(system),
        q = contractOffers(s).find((q) => q.type === "delivery")!;
      expect(
        Math.abs(q.mission!.destination.system - system),
      ).toBeLessThanOrEqual(7);
      expect(generateGalaxy(s.seed)[q.mission!.destination.system].region).toBe(
        Math.floor(system / 5),
      );
      expect(acceptContract(s, q.id)).toBe(true);
      expect(validateState(s)).toBe(true);
    }
    const s = atPort(0, "0-o");
    acceptContract(s, "0-rescue");
    expect(s.contracts[0].mission?.destination.location).toBe("0-o");
  });
});
describe("save v3 compatibility and guardrails", () => {
  it("preserves active sealed cargo and blocks altered destinations or duplicate mission IDs", () => {
    const s = atPort();
    acceptContract(s, "0-delivery");
    expect(decode(encode(s))).toEqual(s);
    s.contracts[0].mission!.destination.location = "1-p0";
    expect(validateState(s)).toBe(false);
    expect(() => decode(encode(s))).toThrow();
    s.contracts[0].mission!.destination.location = "1-s";
    s.contracts.push(structuredClone(s.contracts[0]));
    expect(validateState(s)).toBe(false);
  });
  it("migrates old v2 accepted deliveries with their original item turn-in terms", () => {
    const s = atPort();
    const q = contractOffers(s)[0];
    q.type = "delivery";
    q.id = "old-delivery";
    q.item = "medkit";
    q.target = 2;
    s.contracts.push(q);
    const legacy = JSON.parse(JSON.stringify(s));
    legacy.version = 2;
    delete legacy.health.stimulant;
    delete legacy.contracts[0].mission;
    const migrated = decode(oldSave(legacy, 2));
    expect(migrated.version).toBe(4);
    expect(migrated.health.stimulant).toBe(0);
    expect(migrated.contracts[0].mission).toBeNull();
    expect(claimContract(migrated, "old-delivery")).toBe(true);
    expect(quantity(migrated, "medkit")).toBe(0);
    expect(claimContract(decode(encode(migrated)), "old-delivery")).toBe(false);
  });
  it("rejects malformed nested objects without throwing during validation", () => {
    const s = atPort();
    acceptContract(s, "0-delivery");
    for (const field of ["health", "ship", "contracts"] as const) {
      const copy = JSON.parse(JSON.stringify(s));
      copy[field] = field === "contracts" ? [null] : null;
      expect(validateState(copy)).toBe(false);
    }
    const copy = JSON.parse(JSON.stringify(s));
    copy.contracts[0].mission.manifest = null;
    expect(validateState(copy)).toBe(false);
  });
});
describe("audited gameplay regressions", () => {
  it("does not waste supplies when the corresponding reserve is full", () => {
    const s = atPort();
    s.ship.fuel = 100;
    s.health.oxygen = 100;
    s.health.hunger = 100;
    s.ship.hull = 120;
    const before = { ...s.inventory };
    for (const id of ["fuel", "oxygen", "food", "parts"]) {
      expect(canUseSupply(s, id)).toBe(false);
      expect(useSupply(s, id)).toBe(false);
    }
    expect(s.inventory).toEqual(before);
    s.ship.fuel = 65;
    expect(useSupply(s, "fuel")).toBe(true);
    expect(s.ship.fuel).toBe(95);
  });
  it("rolls back recycling instead of destroying an item when recovered material cannot fit", () => {
    const s = atPort();
    s.upgrades = ["cargo-3"];
    s.mode = "surface";
    s.pack = { gold: 35 };
    const before = structuredClone(s);
    expect(recycleItem(s, "bandage")).toBe(false);
    expect(s).toEqual(before);
    s.mode = "station";
    expect(recycleItem(s, "iron")).toBe(false);
    expect(recycleItem(s, "bandage")).toBe(true);
    expect(s.inventory.iron).toBe(before.inventory.iron + 1);
  });
  it("positive reputation improves both buy and sell prices without same-port arbitrage", () => {
    const s = atPort(),
      buy = price(s, "gold"),
      sell = price(s, "gold", true);
    s.reputation[0] = 100;
    expect(price(s, "gold")).toBeLessThan(buy);
    expect(price(s, "gold", true)).toBeGreaterThan(sell);
    expect(price(s, "gold", true)).toBeLessThan(price(s, "gold"));
    expect(trade(s, "unknown", 1, false, 0)).toBe(false);
  });
  it("stimulant lasts through simulation ticks, expires and survives save/reload", () => {
    const s = atPort();
    s.health.blood = 35;
    s.inventory.stimulant = 1;
    medicalTick(s, 1);
    const before = s.health.consciousness;
    expect(treat(s, "stimulant", 0)).toBe(true);
    medicalTick(s, 10);
    expect(s.health.consciousness).toBeGreaterThan(before);
    expect(s.health.stimulant).toBe(50);
    const loaded = decode(encode(s));
    medicalTick(loaded, 50);
    expect(loaded.health.stimulant).toBe(0);
    expect(loaded.health.consciousness).toBeCloseTo(before, 1);
  });
});
