import { it, expect } from "vitest";
import { newGame } from "../src/core/state";
import {
  interact,
  contacts,
  currentPlanet,
  jump,
  scan,
  launchBoss,
  chooseEnding,
} from "../src/core/actions";
import { tick, type Controls } from "../src/core/simulation";
import {
  acceptContract,
  claimContract,
  buyUpgrade,
  serviceShip,
  equipWeapon,
} from "../src/core/economy";
import { generateSurface } from "../src/world/galaxy";
import { decode, encode, validateState } from "../src/save/storage";
import type { State } from "../src/core/types";

const idle = (): Controls => ({
  mx: 0,
  my: 0,
  aim: null,
  fire: false,
  boost: false,
  brake: false,
  target: null,
});
// This pilot uses the same physics target, actions, economy and combat as the UI.
// It never sets coordinates, health, money, boss HP, progress, inventory or unlocks.
function travel(s: State, x: number, y: number, dock = false) {
  const input = { ...idle(), target: { x, y, dock } };
  const mode = s.mode;
  for (let i = 0; i < 3000; i++) {
    const e = s.enemies[0];
    input.fire =
      !!e &&
      Math.hypot(e.x - s.x, e.y - s.y) < 850 &&
      (!dock || Math.hypot(s.x - x, s.y - y) > 130);
    input.aim = input.fire ? Math.atan2(e.y - s.y, e.x - s.x) : null;
    tick(s, input, 1 / 60);
    expect(s.mode, `Unexpected recovery during travel: ${s.logs[0]}`).toBe(
      mode,
    );
    if (
      Math.hypot(s.x - x, s.y - y) < 18 &&
      Math.hypot(s.vx, s.vy) < 20 &&
      (!dock || Math.abs(s.angle - Math.PI) < 0.1)
    )
      return;
  }
  throw Error(`Target not reached in ${mode}: ${x}, ${y}`);
}
function dock(s: State) {
  const p = contacts(s).find((c) => c.kind === "station")!;
  travel(s, p.x + p.radius + 70, p.y, true);
  interact(s);
  expect(s.mode).toBe("station");
}
function depart(s: State) {
  travel(s, 0, 260);
  interact(s);
  expect(s.mode).toBe("space");
}
function archive(s: State) {
  const p = contacts(s).find((c) => c.kind === "planet")!;
  travel(s, p.x + p.radius + 70, p.y);
  interact(s);
  expect(s.mode).toBe("surface");
  const ruin = generateSurface(s.seed, currentPlanet(s)!).find(
    (n) => n.kind === "ruin",
  )!;
  travel(s, ruin.x, ruin.y);
  interact(s);
  expect(s.evidence).toContain(s.chapter);
  travel(s, 0, 0);
  interact(s);
  expect(s.mode).toBe("space");
}
it("completes New Game through all five real bosses with earned equipment, reloads and an ending", () => {
  let s = newGame();
  for (const id of ["fabricator", "airlock", "reactor", "engine", "cockpit"]) {
    const m = s.ship.modules.find((m) => m.id === id)!;
    travel(s, m.x, m.y);
    interact(s);
  }
  expect(s.mode).toBe("space");
  expect(s.intro).toBe(4);
  scan(s);
  dock(s);
  expect(acceptContract(s, "0-mining")).toBe(true);
  expect(claimContract(s, "0-mining")).toBe(true);
  expect(buyUpgrade(s, "shield-0")).toBe(true);
  expect(buyUpgrade(s, "hull-0")).toBe(true);
  for (let chapter = 0; chapter < 5; chapter++) {
    if (chapter > 0) {
      expect(jump(s, chapter * 5)).toBe(true);
      dock(s);
      if (chapter === 1)
        for (const id of [
          "weapon-0",
          "weapon-1",
          "weapon-2",
          "shield-1",
          "hull-1",
        ])
          expect(buyUpgrade(s, id), id).toBe(true);
      expect(equipWeapon(s, chapter > 0 ? "rail" : "kinetic")).toBe(true);
      expect(serviceShip(s)).toBe(true);
      depart(s);
    } else depart(s);
    archive(s);
    expect(launchBoss(s)).toBe(true);
    for (
      let i = 0;
      i < 7200 && s.chapter === chapter && s.mode === "space";
      i++
    ) {
      const e = s.enemies.find((e) => e.boss)!;
      tick(
        s,
        { ...idle(), fire: true, aim: Math.atan2(e.y - s.y, e.x - s.x) },
        1 / 60,
      );
    }
    expect(s.mode, `Defeat at chapter ${chapter}: ${s.logs[0]}`).toBe("space");
    expect(s.chapter).toBe(chapter + 1);
    expect(s.bosses).toContain(chapter);
    expect(validateState(s)).toBe(true);
    s = decode(encode(s));
  }
  expect(chooseEnding(s, "colonists")).toBe(true);
  expect(s.ending).toBe("colonists");
  s = decode(encode(s));
  expect(s.bosses).toHaveLength(5);
  expect(s.ending).toBe("colonists");
  scan(s);
  expect(jump(s, 21)).toBe(true);
  expect(s.mode).toBe("space");
}, 20000);
