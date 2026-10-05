import { biomes, chapters } from "../data/catalog";
import type { State, Projectile } from "./types";
import { addItem, has, log, shipStats } from "./state";
import { injure, medicalTick } from "./medicine";
import {
  currentPlanet,
  distance,
  randomEvent,
  recover,
  tickInteraction,
} from "./actions";
import { escorts, tickEscorts, hitEscort } from "./escort";
export type Controls = {
  mx: number;
  my: number;
  aim: number | null;
  fire: boolean;
  boost: boolean;
  brake: boolean;
  target: { x: number; y: number; dock?: boolean } | null;
};
export function damageShip(s: State, amount: number) {
  if (has(s, "armor")) amount *= 0.7;
  if (has(s, "phase")) amount *= 0.85;
  const shieldCost = has(s, "shieldArmor") ? 0.75 : 1;
  const absorbed = Math.min(amount, s.ship.shield / shieldCost);
  s.ship.shield -= absorbed * shieldCost;
  amount -= absorbed;
  s.ship.hull = Math.max(0, s.ship.hull - amount);
  if (amount > 0) {
    const m = s.ship.modules[Math.floor((s.time * 13) % s.ship.modules.length)];
    m.integrity = Math.max(0, m.integrity - amount * 0.4);
    if (m.integrity < 40) m.breach = true;
    if (m.integrity < 25) m.fire = Math.min(30, m.fire + 2);
  }
}
export function fire(s: State) {
  if (s.cooldown > 0 || s.projectiles.length > 180) return false;
  const ground = s.mode === "surface" || s.mode === "derelict";
  const w = ground ? "kinetic" : s.ship.weapon;
  const energy = w !== "kinetic" && w !== "missile" && w !== "mine";
  if (energy) {
    const cost = has(s, "ionFilter") ? 2 : 4;
    if (s.ship.energy < cost) return false;
    s.ship.energy -= cost;
  } else {
    if (s.ship.ammo <= 0) {
      return false;
    }
    s.ship.ammo--;
  }
  const damage: Record<string, number> = {
    kinetic: 18,
    laser: 23,
    missile: 65,
    rail: 90,
    ion: 16,
    plasma: 36,
    mine: 100,
  };
  const velocity: Record<string, number> = {
    kinetic: 650,
    laser: 900,
    missile: 380,
    rail: 1200,
    ion: 650,
    plasma: 520,
    mine: 40,
  };
  s.cooldown =
    w === "rail" ? 0.8 : w === "missile" ? 0.7 : w === "mine" ? 1.2 : 0.19;
  s.ship.heat = Math.min(100, s.ship.heat + (w === "plasma" ? 7 : 2));
  for (let i = 0; i < (has(s, "double") && !ground ? 2 : 1); i++) {
    const a = s.angle + (i ? -0.08 : 0);
    s.projectiles.push({
      x: s.x + Math.cos(a) * 30,
      y: s.y + Math.sin(a) * 30,
      vx: Math.cos(a) * velocity[w],
      vy: Math.sin(a) * velocity[w],
      damage:
        damage[w] *
        (has(s, "reactor") && energy ? 1.4 : 1) *
        (ground
          ? Math.max(
              0.4,
              (s.health.parts[2].health + s.health.parts[3].health) / 200,
            )
          : 1),
      life: w === "mine" ? 8 : 2,
      owner: "player",
      weapon: w,
    });
  }
  return true;
}
function enemyShot(
  s: State,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
) {
  if (s.projectiles.length < 200)
    s.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 4,
      damage,
      owner: "enemy",
      weapon: "plasma",
    });
}
export function tick(s: State, input: Controls, dt: number) {
  dt = Math.min(0.05, Math.max(0, dt));
  s.time += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  const stats = shipStats(s);
  const flying = s.mode === "space" || s.mode === "eva";
  const interior =
    s.mode === "interior" || s.mode === "station" || s.mode === "derelict";
  let mx = input.mx,
    my = input.my;
  if (input.target) {
    const dx = input.target.x - s.x,
      dy = input.target.y - s.y,
      d = Math.hypot(dx, dy);
    if (d < 18) {
      mx = 0;
      my = 0;
      s.vx *= Math.exp(-dt * 8);
      s.vy *= Math.exp(-dt * 8);
      if (input.target.dock) s.angle = Math.PI;
      else input.target = null;
    } else {
      mx = dx / d;
      my = dy / d;
      if (flying && d < 130) {
        mx *= d / 130;
        my *= d / 130;
        s.vx *= Math.exp(-dt * 3);
        s.vy *= Math.exp(-dt * 3);
      }
      s.angle = Math.atan2(dy, dx);
    }
  }
  const thrust = Math.hypot(mx, my);
  const injuredLeg =
    (s.health.parts[4].health + s.health.parts[5].health) / 200;
  const legFracture = s.health.parts.slice(4).some((p) => p.wounds.fracture)
    ? 0.6
    : 1;
  if (flying) {
    const engine = s.ship.modules.find((m) => m.id === "engine")!;
    const efficiency =
      s.mode === "eva"
        ? 1
        : has(s, "backup")
          ? 1
          : Math.max(0.25, engine.integrity / 100);
    const speed = s.mode === "eva" ? 105 : stats.speed;
    const boost =
      input.boost && s.ship.fuel > 0 ? (has(s, "boost") ? 2.5 : 1.7) : 1;
    if (s.ship.fuel > 0 || s.mode === "eva") {
      s.vx += mx * (has(s, "thrust") ? 220 : 160) * dt * efficiency * boost;
      s.vy += my * (has(s, "thrust") ? 220 : 160) * dt * efficiency * boost;
      if (thrust && s.mode === "space" && !has(s, "sail"))
        s.ship.fuel = Math.max(0, s.ship.fuel - dt * 0.012 * boost);
    }
    s.vx *= Math.exp(-dt * 0.24);
    s.vy *= Math.exp(-dt * 0.24);
    if (input.brake) {
      s.vx *= Math.exp(-dt * (has(s, "brake") ? 10 : 4));
      s.vy *= Math.exp(-dt * (has(s, "brake") ? 10 : 4));
    }
    const v = Math.hypot(s.vx, s.vy);
    if (v > speed * boost) {
      s.vx *= (speed * boost) / v;
      s.vy *= (speed * boost) / v;
    }
  } else {
    s.vx = mx * 125 * Math.max(0.35, injuredLeg) * legFracture;
    s.vy = my * 125 * Math.max(0.35, injuredLeg) * legFracture;
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (interior) {
    s.x = Math.max(-230, Math.min(230, s.x));
    s.y = Math.max(-225, Math.min(290, s.y));
  } else if (s.mode === "surface") {
    s.x = Math.max(-1050, Math.min(1050, s.x));
    s.y = Math.max(-950, Math.min(950, s.y));
  } else {
    s.x = Math.max(-2700, Math.min(2700, s.x));
    s.y = Math.max(-2700, Math.min(2700, s.y));
  }
  if (input.aim !== null) s.angle = input.aim;
  else if (!input.target && thrust > 0.1) {
    const target = Math.atan2(my, mx),
      diff = Math.atan2(Math.sin(target - s.angle), Math.cos(target - s.angle));
    s.angle += diff * Math.min(1, dt * (has(s, "turn") ? 14 : 8));
  }
  tickInteraction(s, dt);
  if (has(s, "aim") && s.enemies.length && flying && input.fire) {
    const e = s.enemies
      .slice()
      .sort((a, b) => distance(s, a) - distance(s, b))[0];
    s.angle = Math.atan2(e.y - s.y, e.x - s.x);
  }
  if (input.fire && ["space", "surface", "derelict"].includes(s.mode)) fire(s);
  s.ship.energy = Math.min(
    stats.energy,
    s.ship.energy +
      dt *
        (has(s, "regen") ? 8 : 4) *
        (s.ship.modules.find((m) => m.id === "reactor")!.integrity / 100),
  );
  s.ship.shield = Math.min(
    stats.shield,
    s.ship.shield +
      dt *
        (has(s, "shieldRegen") ? 6 : 2) *
        ((s.ship.modules.find((m) => m.id === "shield")?.integrity ?? 100) /
          100),
  );
  s.ship.heat = Math.max(0, s.ship.heat - dt * (has(s, "heat") ? 12 : 5));
  if (s.ship.heat > 90) s.ship.hull = Math.max(0, s.ship.hull - dt * 0.2);
  if (s.mode !== "station") {
    for (const m of s.ship.modules) {
      if (m.fire > 0) {
        m.fire = Math.min(40, m.fire + dt * 0.02);
        m.integrity = Math.max(0, m.integrity - dt * 0.04 * m.fire);
        s.ship.hull = Math.max(0, s.ship.hull - dt * 0.006 * m.fire);
        if (has(s, "fire")) m.fire = Math.max(0, m.fire - dt * 2);
        if (
          s.mode === "interior" &&
          Math.hypot(s.x - m.x, s.y - m.y) < 80 &&
          Math.floor(s.time / 4) > Math.floor((s.time - dt) / 4)
        )
          injure(s.health, 3, "burn", 3);
        if (
          !has(s, "fire") &&
          m.fire > 12 &&
          Math.floor(s.time / 15) > Math.floor((s.time - dt) / 15)
        ) {
          const neighbor = s.ship.modules.find(
            (n) =>
              n !== m && n.fire === 0 && Math.hypot(n.x - m.x, n.y - m.y) < 225,
          );
          if (neighbor) {
            neighbor.fire = 4;
            log(s, `Огонь распространяется: ${neighbor.name}.`);
          }
        }
      }
      if (m.breach && s.intro > 0)
        s.health.oxygen = Math.max(
          0,
          s.health.oxygen - dt * (has(s, "seal") ? 0.035 : 0.12),
        );
    }
  }
  if (s.mode === "interior" && s.intro === 0)
    s.health.oxygen = Math.max(70, s.health.oxygen - dt * 0.04);
  else if (
    s.mode === "space" ||
    s.mode === "interior" ||
    s.mode === "station"
  ) {
    if (!s.ship.modules.some((m) => m.breach))
      s.health.oxygen = Math.min(
        stats.oxygen,
        s.health.oxygen +
          dt *
            2 *
            ((s.ship.modules.find((m) => m.id === "oxygen")?.integrity ?? 100) /
              100),
      );
  }
  if (s.mode === "surface" || s.mode === "eva" || s.mode === "derelict") {
    s.health.oxygen = Math.max(0, s.health.oxygen - dt * 0.1);
    const b = currentPlanet(s);
    if (b) {
      const biome = biomes[b.biome];
      if (!has(s, "filter") && biome.hazard === "toxin")
        s.health.parts[1].wounds.toxin =
          (s.health.parts[1].wounds.toxin ?? 0) + dt * 0.01;
      if (!has(s, "thermal") && ["heat", "cold"].includes(biome.hazard)) {
        s.health.temperature += dt * (biome.hazard === "heat" ? 0.002 : -0.002);
        s.health.parts[4].health = Math.max(
          0,
          s.health.parts[4].health - dt * 0.008,
        );
      }
      s.health.radiation = Math.min(
        100,
        s.health.radiation + biome.radiation * dt * 0.009,
      );
    }
  }
  if (has(s, "doctor") && s.mode === "interior") {
    s.health.parts.forEach(
      (p) => (p.health = Math.min(100, p.health + dt * 0.15)),
    );
    s.health.blood = Math.min(100, s.health.blood + dt * 0.08);
  }
  if (has(s, "nano"))
    s.ship.hull = Math.min(stats.hull, s.ship.hull + dt * 0.15);
  if (
    has(s, "repairDrone") &&
    s.ship.hull < stats.hull - 25 &&
    (s.inventory.parts ?? 0) > 0
  ) {
    s.inventory.parts--;
    s.ship.hull = Math.min(stats.hull, s.ship.hull + 25);
  }
  medicalTick(s, dt);
  tickEscorts(s, dt);
  const convoyShips = escorts(s)
    .map((e) => e.ship)
    .filter((ship) => ship.system === s.system && !ship.arrived);
  if (s.mode === "space" || s.mode === "surface" || s.mode === "derelict") {
    for (const e of s.enemies) {
      e.disabled = Math.max(0, e.disabled - dt);
      e.cooldown -= dt;
      const ally =
        s.mode === "space"
          ? convoyShips.find(
              (ship) =>
                ship.hull > 0 &&
                (e.id.startsWith("escort:") ||
                  distance(e, ship) < distance(e, s)),
            )
          : undefined;
      const target = ally ?? s;
      const d = distance(target, e);
      if (d > 1800) continue;
      const ground = s.mode === "surface" || s.mode === "derelict";
      const a = Math.atan2(target.y - e.y, target.x - e.x);
      e.angle = a;
      if (e.boss) {
        e.phase = e.hp / e.maxHp < 0.3 ? 3 : e.hp / e.maxHp < 0.65 ? 2 : 1;
      }
      const detect = has(s, "cloak") ? 450 : 900;
      if (d < detect || e.boss) {
        const speed =
          !ground && !e.boss && e.hp < e.maxHp * 0.22
            ? 0
            : e.disabled > 0
              ? 15
              : ground
                ? 45
                : e.boss
                  ? 65
                  : 85 + (s.system / 5) * 10;
        const orbit =
          e.boss && e.kind === "beast" ? 1.1 : e.kind === "drone" ? 0.7 : 0;
        const move =
          d > (ground ? 30 : e.boss ? 350 : 270) ? 1 : d < 150 ? -1 : 0;
        e.x += (Math.cos(a) * move - Math.sin(a) * orbit) * speed * dt;
        e.y += (Math.sin(a) * move + Math.cos(a) * orbit) * speed * dt;
        if (
          e.cooldown <= 0 &&
          d < 1000 &&
          (ground || e.boss || e.hp >= e.maxHp * 0.22)
        ) {
          e.cooldown = e.boss
            ? Math.max(0.5, 2 - e.phase * 0.35)
            : ground
              ? 1.8
              : 2.3;
          if (ground && d < 45) {
            injure(s.health, Math.floor(s.time) % 6, "cut", 5);
          } else if (!ground || s.mode === "derelict") {
            const dmg = e.boss
              ? 10 + s.chapter * 3
              : 7 + Math.floor(s.system / 5) * 2;
            if (e.boss && e.kind === "station") {
              for (let i = 0; i < 8 + e.phase * 2; i++)
                enemyShot(
                  s,
                  e.x,
                  e.y,
                  s.time + (i * Math.PI * 2) / (8 + e.phase * 2),
                  180,
                  dmg,
                );
            } else if (e.boss && e.kind === "final") {
              for (let i = 0; i < 12; i++)
                enemyShot(
                  s,
                  e.x,
                  e.y,
                  a + (i * Math.PI) / 6,
                  200 + e.phase * 25,
                  dmg,
                );
            } else if (e.boss && e.kind === "fleet") {
              for (let i = -e.phase; i <= e.phase; i++)
                enemyShot(s, e.x + i * 45, e.y, a + i * 0.12, 280, dmg);
            } else if (e.boss && e.kind === "beast") {
              for (let i = -2; i <= 2; i++)
                enemyShot(s, e.x, e.y, a + i * 0.28, 230 + e.phase * 35, dmg);
            } else {
              for (let i = 0; i < (e.boss ? e.phase : 1); i++)
                enemyShot(s, e.x, e.y, a + (i - 0.5) * 0.12, 250, dmg);
            }
          }
        }
      }
    }
    for (const p of s.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.owner === "player") {
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          if (distance(p, e) < (e.boss ? 55 : 22)) {
            const absorb = Math.min(e.shield, p.damage);
            e.shield -= absorb;
            e.hp -= p.damage - absorb;
            if (p.weapon === "ion") e.disabled = 4;
            if (p.weapon === "plasma") e.hp -= 8;
            if (p.weapon === "missile" || p.weapon === "mine")
              s.enemies
                .filter((o) => o !== e && distance(o, e) < 140)
                .forEach((o) => (o.hp -= p.damage * 0.5));
            p.life = 0;
            break;
          }
        }
      } else if (
        s.mode === "space" &&
        convoyShips.some(
          (ship) =>
            ship.hull > 0 &&
            distance(p, ship) < 25 &&
            hitEscort(s, ship, p.damage),
        )
      ) {
        p.life = 0;
      } else if (distance(p, s) < 22) {
        if (s.mode === "space") damageShip(s, p.damage);
        else
          injure(s.health, Math.floor(s.time * 10) % 6, "puncture", p.damage);
        if (has(s, "reflect")) {
          const e = s.enemies.find((e) => distance(e, s) < 400);
          if (e) e.hp -= 4;
        }
        p.life = 0;
      }
    }
    const dead = s.enemies.filter((e) => e.hp <= 0);
    for (const e of dead) {
      s.kills.push(e.id);
      s.stats.kills++;
      s.credits += e.boss ? 1600 + s.chapter * 550 : 120;
      addItem(s, "iron", e.boss ? 8 : 2);
      s.contracts
        .filter((q) => q.type === "hunt" && !q.complete && s.mode === "space")
        .forEach((q) => q.progress++);
      s.reputation[0] = Math.min(100, s.reputation[0] + 2);
      s.reputation[3] = Math.max(-100, s.reputation[3] - 2);
      if (e.boss) {
        s.bosses.push(s.chapter);
        log(s, `${e.name} уничтожен. ${chapters[s.chapter].reveal}`);
        s.chapter++;
        if (s.chapter < 5) {
          for (let i = s.chapter * 5; i < s.chapter * 5 + 4; i++)
            if (!s.discovered.includes(i)) s.discovered.push(i);
          log(
            s,
            `Новая глава: ${chapters[s.chapter].name}. Следующий регион открыт.`,
          );
        } else
          log(s, "Все узлы отключены. Откройте журнал и выберите судьбу Хора.");
      } else log(s, `${e.name} уничтожен. Груз доступен для сбора.`);
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    s.projectiles = s.projectiles.filter((p) => p.life > 0);
  }
  if (s.mode === "space") {
    s.eventClock -= dt;
    if (s.eventClock <= 0) {
      s.eventClock = 80 + ((s.eventIndex * 31) % 60);
      randomEvent(s);
    }
  }
  if (
    s.ship.hull <= 0 ||
    s.health.blood < 5 ||
    s.health.consciousness < 3 ||
    s.health.parts[0].health <= 0 ||
    s.health.parts[1].health <= 0
  ) {
    recover(s);
    input.target = null;
  }
}
