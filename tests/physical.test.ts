import { expect, it } from "vitest";
import { newGame, quantity } from "../src/core/state";
import { interact, scan, enterSpace, jump, boardOwnShip, recover } from "../src/core/actions";
import { tick, type Controls } from "../src/core/simulation";
import {
  requestDock,
  captureDock,
  berth,
  releaseDock,
} from "../src/core/docking";
import { stationFloor, stationLayout } from "../src/world/stations";
import {
  ensureResidents,
  activeResidents,
  serviceAvailable,
  tickResidents,
  talkResident,
} from "../src/core/residents";
import {
  serviceShip,
  trade,
  acceptContract,
  claimContract,
  buyUpgrade,
} from "../src/core/economy";
import { encode, decode, validateState } from "../src/save/storage";
import { hash } from "../src/world/galaxy";
const idle = (): Controls => ({
  mx: 0,
  my: 0,
  fire: false,
  boost: false,
  brake: false,
  aim: null,
  target: null,
});
function advance(
  s: ReturnType<typeof newGame>,
  seconds: number,
  input = idle(),
) {
  for (let i = 0; i < seconds * 60; i++) tick(s, input, 1 / 60);
}
function walk(s: ReturnType<typeof newGame>, x: number, y: number) {
  advance(s, Math.hypot(x - s.x, y - s.y) / 110 + 1, {
    ...idle(),
    target: { x, y },
  });
}
function portScene() {
  const s = newGame();
  s.intro = 4;
  s.mode = "station";
  s.location = "0-s";
  s.docking = {
    port: { system: 0, location: "0-s" },
    phase: "ready",
    timer: 0,
    pressure: 1,
    shipDoor: true,
    stationDoor: true,
  };
  s.x = 0;
  s.y = 440;
  ensureResidents(s);
  return s;
}
it("a fresh captain physically repairs, flies, requests and captures a berth before entering through two doors", () => {
  let s = newGame();
  for (const id of ["fabricator", "airlock", "reactor", "engine", "cockpit"]) {
    const m = s.ship.modules.find((m) => m.id === id)!;
    walk(s, m.x, m.y);
    interact(s);
    advance(s, 5);
  }
  expect(s.intro).toBe(4);
  expect(s.mode).toBe("space");
  expect(quantity(s, "parts")).toBe(2);
  scan(s);
  expect(captureDock(s, "0-s")).toBe(false);
  expect(requestDock(s, "0-s")).toBe(true);
  const p = berth(s)!;
  advance(s, 8, { ...idle(), target: { ...p, dock: true } });
  expect(captureDock(s, "0-s")).toBe(true);
  expect(s.mode).toBe("space");
  expect(s.docking.pressure).toBe(0);
  advance(s, 4.1);
  expect(s.docking.phase).toBe("equalizing");
  s = decode(encode(s));
  advance(s, 4.1);
  expect(s.docking.phase).toBe("ready");
  const parked = { x: s.x, y: s.y };
  boardOwnShip(s);
  walk(s, 0, 260);
  interact(s);
  expect(s.mode).toBe("station");
  expect(s.y).toBeGreaterThan(235);
  expect(s.orbit.x).toBe(parked.x);
  walk(s, 0, 440);
  interact(s);
  expect(s.docking.stationDoor).toBe(true);
  advance(s, 2, { ...idle(), mx: 0, my: 1 });
  expect(s.y).toBeGreaterThan(480);
  expect(validateState(s)).toBe(true);
});
it("closed station airlocks and walls constrain actual movement", () => {
  const s = portScene();
  s.docking.stationDoor = false;
  advance(s, 5, { ...idle(), my: 1 });
  expect(s.y).toBeLessThan(462);
  s.docking.stationDoor = true;
  advance(s, 2, { ...idle(), my: 1 });
  expect(s.y).toBeGreaterThan(480);
  const old = s.x;
  advance(s, 4, { ...idle(), mx: 1 });
  expect(s.x - old).toBeLessThan(50);
  expect(stationFloor(s.seed, s.location, s.x, s.y)).toBe(true);
});
it("poor docking alignment damages the hull without teleporting into a station", () => {
  const s = newGame();
  s.mode = "space";
  scan(s);
  requestDock(s, "0-s");
  const p = berth(s)!;
  s.x = p.x;
  s.y = p.y;
  s.angle = 0;
  expect(captureDock(s, "0-s")).toBe(false);
  expect(s.ship.hull).toBe(76);
  expect(s.mode).toBe("space");
  expect(s.docking.phase).toBe("requested");
  s.angle = Math.PI;
  expect(captureDock(s, "0-s")).toBe(true);
  expect(jump(s, 1)).toBe(false);
});
it("station generation is deterministic, connected and varies facilities", () => {
  expect(stationLayout("A", "0-s")).toEqual(stationLayout("A", "0-s"));
  expect(stationLayout("A", "0-s")).not.toEqual(stationLayout("B", "0-s"));
  for (const r of stationLayout("A", "0-s").rooms) {
    expect(stationFloor("A", "0-s", r.x, r.y)).toBe(true);
    expect(stationFloor("A", "0-s", 0, r.y)).toBe(true);
  }
});
it("remote station shopping and contracts are rejected; walking to the named staff enables real transactions", () => {
  const s = portScene();
  expect(trade(s, "iron", 1, false, 0)).toBe(false);
  expect(acceptContract(s, "0-mining")).toBe(false);
  expect(buyUpgrade(s, "shield-0")).toBe(false);
  const trader = activeResidents(s).find((n) => n.role === "trade")!;
  s.x = trader.x;
  s.y = trader.y;
  expect(trade(s, "iron", 1, false, 0)).toBe(true);
  const agent = activeResidents(s).find((n) => n.role === "contracts")!;
  s.x = agent.x;
  s.y = agent.y;
  expect(acceptContract(s, "0-mining")).toBe(true);
  expect(claimContract(s, "0-mining")).toBe(true);
});
it("named station staff walk along the corridor to their homes and persist positions/opinions/memories", () => {
  const s = portScene(),
    doctor = activeResidents(s).find((n) => n.role === "medical")!;
  s.x = doctor.x;
  s.y = doctor.y;
  expect(talkResident(s, doctor.id, true)).toBe(true);
  expect(doctor.opinion).toBe(2);
  s.time = 901;
  for (let i = 0; i < 9000; i++) tickResidents(s, 1 / 60);
  expect(
    Math.hypot(doctor.x - doctor.homeX, doctor.y - doctor.homeY),
  ).toBeLessThan(4);
  expect(decode(encode(s)).residents).toEqual(s.residents);
});
it("a paid engineer physically walks to the ship, repairs over time and returns before release", () => {
  let s = portScene();
  const n = activeResidents(s).find((n) => n.role === "tech")!;
  s.x = n.x;
  s.y = n.y;
  s.ship.hull = 40;
  expect(serviceShip(s)).toBe(true);
  expect(s.ship.hull).toBe(40);
  expect(s.credits).toBe(470);
  advance(s, 5);
  expect(s.maintenance?.progress).toBe(0);
  s = decode(encode(s));
  const worker = s.residents.find((r) => r.id === s.maintenance!.worker)!;
  advance(s, 180);
  expect(s.maintenance).toBeNull();
  expect(s.ship.hull).toBe(120);
  expect(s.ship.modules.every((m) => m.integrity === 100 && !m.breach)).toBe(
    true,
  );
  expect(worker.y).toBeGreaterThan(500);
  expect(s.chronicle.some((e) => e.text.includes("вернулся"))).toBe(true);
  expect(validateState(s)).toBe(true);
});
it("closing a hatch obstructs the engineer rather than completing repairs off-screen", () => {
  const s = portScene();
  const n = activeResidents(s).find((n) => n.role === "tech")!;
  s.x = n.x;
  s.y = n.y;
  serviceShip(s);
  s.docking.stationDoor = false;
  advance(s, 60);
  expect(s.maintenance?.progress).toBe(0);
  expect(n.y).toBeGreaterThan(498);
  s.mode = "space";
  s.docking.shipDoor = false;
  expect(releaseDock(s)).toBe(false);
});
it("a v5 station save migrates into its moored ship with missions and resources intact", () => {
  const old: any = newGame();
  old.version = 5;
  old.mode = "station";
  old.location = "0-s";
  delete old.docking;
  delete old.residents;
  delete old.maintenance;
  const payload = JSON.stringify(old),
    s = decode(
      JSON.stringify({
        format: "STARFALL",
        saveVersion: 5,
        payload,
        checksum: hash(payload),
      }),
    );
  expect(s.version).toBe(6);
  expect(s.mode).toBe("interior");
  expect(s.docking.port?.location).toBe("0-s");
  expect(s.inventory).toEqual(old.inventory);
});
it("physical welding does not consume hull parts from an inventory menu", () => {
  const s = newGame();
  s.intro = 4;
  s.x = 150;
  s.y = -150;
  const parts = quantity(s, "parts");
  interact(s);
  expect(s.ship.hull).toBe(80);
  advance(s, 5.1);
  expect(s.ship.hull).toBe(105);
  expect(quantity(s, "parts")).toBe(parts - 1);
});

it("emergency recovery preserves a valid moored-ship state and allows physical station re-entry",()=>{const s=newGame();s.mode="space";recover(s);expect(validateState(s)).toBe(true);expect(s.mode).toBe("interior");expect(s.docking.phase).toBe("ready");interact(s);expect(s.mode).toBe("station");expect(validateState(s)).toBe(true);});
