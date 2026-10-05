import { describe, it, expect, beforeEach } from "vitest";
import { generateGalaxy, generateSurface } from "../src/world/galaxy";
import {
  newGame,
  shipStats,
  addItem,
  consume,
  weight,
} from "../src/core/state";
import { injure, treat, medicalTick } from "../src/core/medicine";
import { damageShip, tick, type Controls } from "../src/core/simulation";
import {
  craft,
  trade,
  price,
  buyUpgrade,
  claimContract,
  contractOffers,
} from "../src/core/economy";
import { encode, decode, validateState, save, load } from "../src/save/storage";
import {
  interact,
  enterSpace,
  jump,
  scan,
  launchBoss,
  chooseEnding,
} from "../src/core/actions";
const idle = (): Controls => ({
  mx: 0,
  my: 0,
  aim: null,
  fire: false,
  boost: false,
  brake: false,
  target: null,
});
describe("seeded universe", () => {
  it("has a deterministic galaxy with distinct seeds and enough real locations", () => {
    const g = generateGalaxy("alpha");
    expect(g).toEqual(generateGalaxy("alpha"));
    expect(g).not.toEqual(generateGalaxy("beta"));
    expect(g).toHaveLength(25);
    expect(new Set(g.map((x) => x.region)).size).toBe(5);
    expect(
      g.flatMap((x) => x.contacts).filter((x) => x.kind === "planet").length,
    ).toBeGreaterThan(60);
    expect(
      g.flatMap((x) => x.contacts).filter((x) => x.kind === "station").length,
    ).toBe(25);
    expect(
      g.flatMap((x) => x.contacts).filter((x) => x.kind === "outpost").length,
    ).toBeGreaterThan(10);
  });
  it("produces bounded reproducible surface resources and a reachable archive", () => {
    const p = generateGalaxy("test")[0].contacts[0];
    const surface = generateSurface("test", p);
    expect(surface).toEqual(generateSurface("test", p));
    expect(surface.some((n) => n.kind === "ruin")).toBe(true);
    expect(
      surface.every((n) => Math.abs(n.x) < 1050 && Math.abs(n.y) < 950),
    ).toBe(true);
  });
});
describe("inventory and production", () => {
  it("enforces capacity and prevents negative stocks", () => {
    const s = newGame();
    expect(addItem(s, "iron", 200)).toBe(false);
    expect(consume(s, "iron", 100)).toBe(false);
    expect(consume(s, "iron", 3)).toBe(true);
    expect(s.inventory.iron).toBe(5);
    expect(weight(s)).toBeLessThan(shipStats(s).cargo);
  });
  it("crafts atomically and requires a real workbench", () => {
    const s = newGame();
    const before = s.inventory.parts;
    expect(craft(s, "parts")).toBe(true);
    expect(s.inventory.parts).toBe(before + 2);
    s.mode = "surface";
    expect(craft(s, "parts")).toBe(false);
    s.upgrades = ["cargo-4"];
    expect(craft(s, "parts")).toBe(true);
  });
  it("does not lose ingredients when output exceeds capacity", () => {
    const s = newGame();
    s.inventory = { iron: 3, copper: 1, gold: 96 };
    const before = { ...s.inventory };
    expect(craft(s, "parts")).toBe(true);
    expect(s.inventory.parts).toBe(2);
    s.inventory = { ice: 3, gold: 97 };
    expect(craft(s, "oxygen")).toBe(true);
    expect(s.inventory.oxygen).toBe(2);
    expect(before.iron).toBe(3);
  });
});
describe("damage and medicine", () => {
  it("shield absorbs hits before hull and module damage", () => {
    const s = newGame();
    s.ship.shield = 40;
    const hull = s.ship.hull;
    damageShip(s, 20);
    expect(s.ship.hull).toBe(hull);
    expect(s.ship.shield).toBe(20);
    damageShip(s, 35);
    expect(s.ship.hull).toBe(hull - 15);
  });
  it("bleeding has consequences, bandages stop it, splints fix fractures", () => {
    const s = newGame();
    injure(s.health, 2, "cut", 20);
    medicalTick(s, 10);
    expect(s.health.blood).toBeLessThan(100);
    const health = s.health.parts[2].health;
    expect(treat(s, "bandage", 2)).toBe(true);
    expect(s.health.parts[2].health).toBe(health);
    expect(s.health.parts[2].wounds.cut).toBeUndefined();
    injure(s.health, 4, "fracture", 30);
    s.inventory.splint = 1;
    expect(treat(s, "splint", 4)).toBe(true);
    expect(s.health.parts[4].wounds.fracture).toBeUndefined();
  });
  it("does not consume irrelevant medication", () => {
    const s = newGame();
    expect(treat(s, "bandage", 0)).toBe(false);
    expect(s.inventory.bandage).toBe(4);
  });
});
describe("economy and technologies", () => {
  it("applies local markets and reputation and blocks invalid trades", () => {
    const s = newGame();
    expect(trade(s, "iron", 1, false, 0)).toBe(false);
    s.mode = "station";
    const cost = price(s, "iron");
    const balance = s.credits;
    expect(trade(s, "iron", 2, false, 0)).toBe(true);
    expect(s.credits).toBe(balance - cost * 2);
    s.reputation[0] = 100;
    expect(price(s, "iron")).toBeLessThan(cost);
    expect(trade(s, "iron", -1, false, 0)).toBe(false);
  });
  it("requires previous technology, a station and chapter gates", () => {
    const s = newGame();
    s.credits = 10000;
    expect(buyUpgrade(s, "engine-0")).toBe(false);
    s.mode = "station";
    expect(buyUpgrade(s, "engine-1")).toBe(false);
    expect(buyUpgrade(s, "engine-0")).toBe(true);
    expect(buyUpgrade(s, "engine-1")).toBe(true);
    expect(buyUpgrade(s, "engine-2")).toBe(false);
    expect(buyUpgrade(s, "engine-0")).toBe(false);
  });
  it("pays each contract exactly once and consumes delivery cargo", () => {
    const s = newGame();
    s.mode = "station";
    s.contracts = [contractOffers(s)[0]];
    expect(claimContract(s, s.contracts[0].id)).toBe(true);
    expect(s.inventory.iron).toBeUndefined();
    expect(claimContract(s, s.contracts[0].id)).toBe(false);
  });
});
describe("save integrity", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
      },
    });
  });
  it("round-trips all progress and rejects corruption and unknown versions", () => {
    const s = newGame("custom", 2);
    expect(validateState(s)).toBe(true);
    expect(decode(encode(s))).toEqual(s);
    const e = JSON.parse(encode(s));
    e.payload = e.payload.replace("650", "999");
    expect(() => decode(JSON.stringify(e))).toThrow();
    s.version = 99 as 2;
    expect(() => decode(encode(s))).toThrow();
  });
  it("has independent slots and a last good backup", () => {
    const s = newGame();
    save(s);
    s.credits = 800;
    save(s);
    localStorage.setItem("starfall-save-v1-0", "broken");
    expect(load(0)?.credits).toBe(650);
    expect(load(1)).toBeNull();
  });
  it("rejects malformed nested settings and invalid item IDs", () => {
    const s = newGame();
    s.inventory.fake = 1;
    expect(validateState(s)).toBe(false);
    delete s.inventory.fake;
    s.settings.uiScale = 20;
    expect(validateState(s)).toBe(false);
  });
});
describe("playable campaign", () => {
  it("walks the repair introduction into real flight", () => {
    const s = newGame();
    s.x = 150;
    s.y = 150;
    interact(s);
    expect(s.intro).toBe(1);
    s.x = 0;
    s.y = 260;
    interact(s);
    expect(s.intro).toBe(2);
    s.x = -150;
    s.y = 0;
    interact(s);
    expect(s.intro).toBe(3);
    s.x = 150;
    interact(s);
    expect(s.intro).toBe(4);
    s.x = 0;
    s.y = -150;
    interact(s);
    expect(s.mode).toBe("space");
    tick(s, { ...idle(), mx: 1 }, 0.05);
    expect(s.vx).toBeGreaterThan(0);
  });
  it("requires docking alignment and supports landing and resource depletion", () => {
    const s = newGame();
    s.intro = 4;
    enterSpace(s);
    s.x = 400;
    s.y = -120;
    s.angle = 0;
    interact(s);
    expect(s.mode).toBe("space");
    s.angle = Math.PI;
    interact(s);
    expect(s.mode).toBe("station");
    s.mode = "space";
    const p = generateGalaxy(s.seed)[0].contacts[0];
    s.x = p.x + p.radius + 50;
    s.y = p.y;
    interact(s);
    expect(s.mode).toBe("surface");
    const ruin = generateSurface(s.seed, p).find((n) => n.kind === "ruin")!;
    s.x = ruin.x;
    s.y = ruin.y;
    interact(s);
    expect(s.evidence).toContain(0);
    const credits = s.credits;
    interact(s);
    expect(s.credits).toBe(credits);
  });
  it("reveals routes, spends fuel and refuses unknown systems", () => {
    const s = newGame();
    enterSpace(s);
    const before = s.ship.fuel;
    expect(jump(s, 24)).toBe(false);
    scan(s);
    expect(jump(s, 1)).toBe(true);
    expect(s.ship.fuel).toBe(before - 12);
    expect(s.stats.jumps).toBe(1);
  });
  it("all five bosses unlock sequentially and offer three endings plus free play", () => {
    const s = newGame();
    s.intro = 4;
    s.docked = true;
    s.ship.hull = 10000;
    enterSpace(s);
    for (let chapter = 0; chapter < 5; chapter++) {
      s.system = chapter * 5;
      s.evidence.push(chapter);
      expect(launchBoss(s)).toBe(true);
      const boss = s.enemies[0];
      expect(boss.boss).toBe(true);
      boss.hp = 0;
      tick(s, idle(), 0.01);
      expect(s.chapter).toBe(chapter + 1);
      expect(s.bosses).toContain(chapter);
      expect(validateState(s)).toBe(true);
    }
    for (const choice of ["destroy", "control", "colonists"]) {
      const copy = structuredClone(s);
      expect(chooseEnding(copy, choice)).toBe(true);
      expect(copy.mode).toBe("space");
      expect(chooseEnding(copy, "destroy")).toBe(false);
    }
  });
});
