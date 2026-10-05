import { it, expect } from "vitest";
import { legacyGame as newGame } from "../src/core/state";
import {
  acceptContract,
  claimContract,
  cancelContract,
} from "../src/core/economy";
import { jump, interact, contacts } from "../src/core/actions";
import { escorts, escortInJumpRange, hitEscort } from "../src/core/escort";
import { tick, type Controls } from "../src/core/simulation";
import { decode, encode, validateState } from "../src/save/storage";
import { hash } from "../src/world/galaxy";
const idle = (): Controls => ({
  mx: 0,
  my: 0,
  aim: null,
  fire: false,
  boost: false,
  brake: false,
  target: null,
});
function mission() {
  const s = newGame();
  s.mode = "station";
  s.location = "0-s";
  expect(acceptContract(s, "0-escort")).toBe(true);
  return s;
}
it("blocks a hyperjump without the convoy and spends neither fuel nor mission progress", () => {
  const s = mission(),
    ship = escorts(s)[0].ship;
  s.mode = "space";
  s.x = -1000;
  s.y = 0;
  const fuel = s.ship.fuel;
  expect(escortInJumpRange(s, ship)).toBe(false);
  expect(jump(s, 1)).toBe(false);
  expect(s.system).toBe(0);
  expect(s.ship.fuel).toBe(fuel);
  expect(ship.system).toBe(0);
  expect(s.contracts[0].progress).toBe(0);
  expect(validateState(s)).toBe(true);
});
it("carries a nearby convoy through a jump and preserves its ambush until defeated, including reload", () => {
  let s = mission();
  s.x = 0;
  s.y = 230;
  interact(s);
  expect(s.mode).toBe("space");
  expect(jump(s, 1)).toBe(true);
  const ally = escorts(s)[0].ship;
  expect(ally.system).toBe(1);
  expect(ally.ambushTriggered).toBe(true);
  expect(s.enemies.filter((e) => e.id === "escort:0-escort")).toHaveLength(1);
  s = decode(encode(s));
  expect(escorts(s)[0].ship).toEqual(ally);
  expect(jump(s, 0)).toBe(true);
  expect(jump(s, 1)).toBe(true);
  expect(s.enemies.filter((e) => e.id === "escort:0-escort")).toHaveLength(1);
  s.kills.push("escort:0-escort");
  expect(jump(s, 0)).toBe(true);
  expect(jump(s, 1)).toBe(true);
  expect(s.enemies.some((e) => e.id === "escort:0-escort")).toBe(false);
});
it("enemy projectiles can destroy the convoy and cause a persisted once-only failure", () => {
  const s = mission();
  s.x = 0;
  s.y = 230;
  interact(s);
  jump(s, 1);
  const ship = escorts(s)[0].ship;
  s.projectiles.push({
    x: ship.x,
    y: ship.y,
    vx: 0,
    vy: 0,
    life: 5,
    damage: 300,
    owner: "enemy",
    weapon: "kinetic",
  });
  tick(s, idle(), 1 / 60);
  expect(ship.hull).toBe(0);
  expect(s.contracts[0].mission?.stage).toBe("failed");
  expect(s.reputation[0]).toBe(-8);
  expect(hitEscort(s, ship, 300)).toBe(false);
  expect(s.reputation[0]).toBe(-8);
  s.mode = "station";
  s.location = "1-s";
  const credits = s.credits;
  expect(claimContract(s, "0-escort")).toBe(false);
  expect(cancelContract(s, "0-escort")).toBe(false);
  expect(s.credits).toBe(credits);
  expect(decode(encode(s)).contracts[0].mission?.stage).toBe("failed");
});
it("requires the convoy to physically reach the destination before paying", () => {
  const s = mission();
  s.x = 0;
  s.y = 230;
  interact(s);
  jump(s, 1);
  const port = contacts(s).find((c) => c.id === "1-s")!;
  const input = {
    ...idle(),
    target: { x: port.x + port.radius + 70, y: port.y, dock: true },
  };
  expect(claimContract(s, "0-escort")).toBe(false);
  for (let i = 0; i < 1800 && s.mode === "space"; i++) {
    const e = s.enemies[0];
    input.fire = !!e;
    input.aim = e ? Math.atan2(e.y - s.y, e.x - s.x) : null;
    tick(s, input, 1 / 60);
    if (
      !s.enemies.length &&
      Math.hypot(s.x - input.target.x, s.y - input.target.y) < 18
    )
      interact(s);
  }
  expect(s.mode).toBe("station");
  expect(escorts(s)[0].ship.arrived).toBe(true);
  expect(s.contracts[0].progress).toBe(1);
  const balance = s.credits;
  expect(claimContract(s, "0-escort")).toBe(true);
  expect(s.credits).toBe(balance + 780);
  expect(claimContract(s, "0-escort")).toBe(false);
  expect(validateState(s)).toBe(true);
});
it("allows only one active convoy and releases that limit on cancellation", () => {
  const s = mission();
  s.system = 1;
  s.location = "1-s";
  expect(acceptContract(s, "1-escort")).toBe(false);
  expect(cancelContract(s, "0-escort")).toBe(true);
  expect(acceptContract(s, "1-escort")).toBe(true);
  expect(validateState(s)).toBe(true);
});
it("migrates published v3 sealed cargo without changing weight, destination or progress", () => {
  const s = newGame();
  s.mode = "station";
  s.location = "0-s";
  acceptContract(s, "0-delivery");
  const old = JSON.parse(JSON.stringify(s));
  old.version = 3;
  delete old.contracts[0].mission.escort;
  const payload = JSON.stringify(old);
  const migrated = decode(
    JSON.stringify({
      format: "STARFALL",
      saveVersion: 3,
      payload,
      checksum: hash(payload),
    }),
  );
  expect(migrated.version).toBe(6);
  expect(migrated.contracts[0].mission?.escort).toBeNull();
  expect(migrated.contracts[0].mission?.destination).toEqual(
    s.contracts[0].mission?.destination,
  );
  expect(migrated.contracts[0].progress).toBe(s.contracts[0].progress);
  expect(validateState(migrated)).toBe(true);
  migrated.contracts[0].mission!.escort = {
    system: 0,
    x: 0,
    y: 0,
    angle: 0,
    hull: 50,
    maxHull: 50,
    arrived: false,
    ambushTriggered: false,
  };
  expect(validateState(migrated)).toBe(false);
});
