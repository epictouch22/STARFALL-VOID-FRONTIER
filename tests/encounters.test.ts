import { describe, expect, it } from "vitest";
import { newGame, quantity } from "../src/core/state";
import {
  beginEncounter,
  resolveEncounter,
  choiceUnavailable,
} from "../src/core/encounters";
import {
  interact,
  scan,
  tickInteraction,
  randomEvent,
} from "../src/core/actions";
import { decode, encode, validateState } from "../src/save/storage";
import { generateGalaxy, hash, random } from "../src/world/galaxy";
import { encounterDefinitions } from "../src/data/encounters";
function scene(kind: "sos" | "beacon" | "inspection") {
  const s = newGame();
  s.mode = "space";
  beginEncounter(s, kind);
  const e = s.encounters[0];
  s.x = e.x;
  s.y = e.y;
  return { s, e };
}
describe("persistent radio choices", () => {
  it("scanning creates real discoverable SOS and beacon signals, never automatic rewards", () => {
    const s = newGame();
    s.mode = "space";
    for (const c of generateGalaxy(s.seed)[0].contacts) {
      s.x = c.x;
      s.y = c.y;
      scan(s);
    }
    expect(s.encounters.map((e) => e.kind).sort()).toEqual(["beacon", "sos"]);
    expect(s.credits).toBe(650);
    expect(decode(encode(s)).encounters).toEqual(s.encounters);
    scan(s);
    expect(s.encounters).toHaveLength(2);
  });
  it("SOS rescue consumes actual medicine/oxygen across containers, records reputation and pays once after reload", () => {
    const { s, e } = scene("sos"),
      oxygen = quantity(s, "oxygen");
    expect(resolveEncounter(s, e.id, "rescue")).toBe(true);
    expect(quantity(s, "medkit")).toBe(1);
    expect(quantity(s, "oxygen")).toBe(oxygen - 1);
    expect(s.credits).toBe(870);
    expect(s.reputation[2]).toBe(23);
    const loaded = decode(encode(s));
    expect(resolveEncounter(loaded, e.id, "rescue")).toBe(false);
    expect(beginEncounter(loaded, "sos")).toBe(false);
    expect(loaded.credits).toBe(870);
    expect(loaded.chronicle).toHaveLength(1);
  });
  it("distant radio tow uses fuel and energy, decline has no reward", () => {
    const { s, e } = scene("sos");
    s.x = 2700;
    s.y = 2700;
    expect(choiceUnavailable(s, e, "rescue")).toContain("300");
    expect(resolveEncounter(s, e.id, "tow")).toBe(true);
    expect(s.ship.fuel).toBe(77);
    expect(s.ship.energy).toBe(50);
    expect(s.credits).toBe(730);
    const other = scene("sos");
    expect(resolveEncounter(other.s, other.e.id, "ignore")).toBe(true);
    expect(other.s.credits).toBe(650);
    expect(other.s.reputation[2]).toBe(12);
  });
  it("cannot pay insufficient resources or answer from a different system", () => {
    const { s, e } = scene("sos");
    delete s.inventory.medkit;
    const before = JSON.stringify(s);
    expect(resolveEncounter(s, e.id, "rescue")).toBe(false);
    expect(s.credits).toBe(650);
    expect(e.resolved).toBeNull();
    expect(JSON.parse(before).inventory).toEqual(s.inventory);
    s.system = 1;
    expect(resolveEncounter(s, e.id, "ignore")).toBe(false);
  });
  it("inspection declarations consume money and cannot confiscate manifests", () => {
    const { s, e } = scene("inspection");
    s.mode = "station";
    s.location = "0-s";
    s.x = 0;
    s.y = 260;
    s.docking = {
      port: { system: 0, location: "0-s" },
      phase: "ready",
      timer: 0,
      pressure: 1,
      shipDoor: true,
      stationDoor: false,
    };
    expect(resolveEncounter(s, e.id, "declare")).toBe(true);
    expect(s.credits).toBe(590);
    expect(s.reputation[0]).toBe(3);
    expect(decode(encode(s)).encounters[0].choice).toBe("declare");
  });
  it("inspection evasion creates a real saved pursuer and refuses lethal or docked escape", () => {
    const { s, e } = scene("inspection");
    s.mode = "station";
    expect(resolveEncounter(s, e.id, "evade")).toBe(false);
    s.mode = "space";
    s.ship.hull = 12;
    expect(resolveEncounter(s, e.id, "evade")).toBe(false);
    s.ship.hull = 80;
    expect(resolveEncounter(s, e.id, "evade")).toBe(true);
    expect(s.ship.hull).toBe(68);
    expect(s.ship.fuel).toBe(77);
    expect(s.reputation[0]).toBe(-10);
    expect(decode(encode(s)).enemies[0].name).toContain("Таможенный");
  });
  it("beacon decoding opens a genuine secret route without giving a story key", () => {
    const { s, e } = scene("beacon");
    expect(resolveEncounter(s, e.id, "decode")).toBe(true);
    expect(s.discovered).toContain(4);
    expect(s.evidence).toEqual([]);
    expect(s.inventory.exo).toBe(2);
    expect(s.ship.energy).toBe(35);
  });
  it("multi-item salvage is atomic if the second reward cannot fit", () => {
    const { s, e } = scene("beacon");
    s.inventory = { iron: 98 };
    const before = { ...s.inventory };
    expect(resolveEncounter(s, e.id, "salvage")).toBe(false);
    expect(s.inventory).toEqual(before);
    expect(s.health.radiation).toBe(0);
    expect(e.resolved).toBeNull();
    s.inventory = {};
    expect(resolveEncounter(s, e.id, "salvage")).toBe(true);
    expect(s.inventory).toEqual({ crystal: 4, copper: 3 });
    expect(s.health.radiation).toBe(8);
  });
  it.each(Object.entries(encounterDefinitions))(
    "all choices in %s have actual core outcomes",
    (kind, def) => {
      for (const c of def.choices) {
        const { s, e } = scene(kind as "sos");
        s.inventory.crystal = 2;
        expect(resolveEncounter(s, e.id, c.id)).toBe(true);
        expect(validateState(s)).toBe(true);
        expect(decode(encode(s)).encounters[0].choice).toBe(c.id);
      }
    },
  );
  it("rejects malformed, forged, duplicate or incomplete encounter records", () => {
    const { s } = scene("beacon");
    for (const mutate of [
      (e: any) => (e.kind = "unknown"),
      (e: any) => (e.id = "beacon:7"),
      (e: any) => (e.x = 0),
      (e: any) => (e.choice = "decode"),
      (e: any) => (e.resolved = 0),
    ]) {
      const copy = structuredClone(s);
      mutate(copy.encounters[0]);
      expect(validateState(copy)).toBe(false);
    }
    s.encounters.push({ ...s.encounters[0] });
    expect(validateState(s)).toBe(false);
  });
  it("random SOS no longer pays automatically", () => {
    let seed = "";
    for (let n = 0; n < 1000; n++)
      if (Math.floor(random(hash(`event${n}-0-0`))() * 32) === 0) {
        seed = `event${n}`;
        break;
      }
    const s = newGame(seed);
    s.mode = "space";
    randomEvent(s);
    expect(s.encounters[0].kind).toBe("sos");
    expect(s.credits).toBe(650);
  });
});
describe("physical work", () => {
  it("collects tools and repairs over time, spends parts at completion, preserves partial work on reload", () => {
    let s = newGame();
    s.x = 150;
    s.y = 150;
    interact(s);
    expect(s.intro).toBe(0);
    tickInteraction(s, 2);
    expect(s.intro).toBe(1);
    s.x = 0;
    s.y = 260;
    const n = quantity(s, "parts");
    interact(s);
    tickInteraction(s, 2);
    s.time = 2;
    s = decode(encode(s));
    expect(s.activity?.elapsed).toBe(2);
    expect(quantity(s, "parts")).toBe(n);
    tickInteraction(s, 3);
    expect(s.intro).toBe(2);
    expect(quantity(s, "parts")).toBe(n - 1);
    expect(s.activity).toBeNull();
  });
  it("moving or cancelling work never spends parts", () => {
    const s = newGame();
    s.intro = 1;
    s.x = 0;
    s.y = 260;
    interact(s);
    s.x = 150;
    tickInteraction(s, 5);
    expect(s.activity).toBeNull();
    expect(quantity(s, "parts")).toBe(5);
    expect(s.ship.modules[5].breach).toBe(true);
    s.x = 0;
    interact(s);
    interact(s);
    expect(s.activity).toBeNull();
    expect(quantity(s, "parts")).toBe(5);
  });
});
