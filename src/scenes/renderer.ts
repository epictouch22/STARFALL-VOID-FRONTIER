import type { State, Module } from "../core/types";
import type { Controls } from "../core/simulation";
import { biomes, items, chapters } from "../data/catalog";
import {
  generateGalaxy,
  generateSurface,
  hash,
  random,
  type Contact,
} from "../world/galaxy";
import { currentPlanet, stationPoints } from "../core/actions";
import { has } from "../core/state";
import { missionTarget } from "../core/economy";
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  scale = 1;
  cx = 0;
  cy = 0;
  private stars: { x: number; y: number; size: number; a: number }[];
  private galaxy: ReturnType<typeof generateGalaxy>;
  private surfaceCache = new Map<string, ReturnType<typeof generateSurface>>();
  private lastTime = 0;
  private lastHull = -1;
  private lastMode = "interior";
  private lastSystem = 0;
  private shake = 0;
  private transition = 0;
  private enemyPositions = new Map<string, { x: number; y: number }>();
  private particles = Array.from({ length: 96 }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    color: "#e9bd79",
  }));
  private emit(x: number, y: number, color: string) {
    let n = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      const a = n * 2.399;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * (35 + n * 3);
      p.vy = Math.sin(a) * (35 + n * 3);
      p.life = 0.5 + (n % 5) * 0.12;
      p.color = color;
      if (++n === 20) break;
    }
  }
  constructor(canvas: HTMLCanvasElement, seed: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    const rng = random(hash(seed));
    this.stars = Array.from({ length: 250 }, () => ({
      x: rng() * 2600,
      y: rng() * 1800,
      size: rng() * 1.4 + 0.3,
      a: rng() * 0.7 + 0.2,
    }));
    this.galaxy = generateGalaxy(seed);
    this.resize();
  }
  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  worldAt(x: number, y: number) {
    return {
      x: (x - this.width / 2) / this.scale + this.cx,
      y: (y - this.height / 2) / this.scale + this.cy,
    };
  }
  draw(s: State, input: Controls, playing = true) {
    const c = this.ctx,
      w = this.width,
      h = this.height;
    const dt = Math.max(0, Math.min(0.05, s.time - this.lastTime));
    this.lastTime = s.time;
    if (playing && !s.settings.reduced) {
      if (this.lastHull >= 0 && s.ship.hull < this.lastHull) {
        this.shake = 0.3;
        this.emit(s.x, s.y, "#f9a978");
      }
      for (const [id, p] of this.enemyPositions)
        if (!s.enemies.some((e) => e.id === id) && s.kills.includes(id))
          this.emit(p.x, p.y, "#edbe77");
      if (s.mode !== this.lastMode || s.system !== this.lastSystem)
        this.transition = 0.8;
    }
    this.lastHull = s.ship.hull;
    this.lastMode = s.mode;
    this.lastSystem = s.system;
    this.enemyPositions = new Map(
      s.enemies.map((e) => [e.id, { x: e.x, y: e.y }]),
    );
    this.shake = Math.max(0, this.shake - dt);
    this.transition = Math.max(0, this.transition - dt);
    const indoor =
      ["interior", "station", "derelict"].includes(s.mode) && playing;
    this.scale = indoor
      ? Math.min(1.15, (w - 30) / 540, (h - 160) / 620)
      : w < 700
        ? s.mode === "surface"
          ? 0.58
          : 0.42
        : 0.85;
    this.cx = indoor ? 0 : s.x;
    this.cy = indoor ? 30 : s.y;
    c.fillStyle = "#070c16";
    c.fillRect(0, 0, w, h);
    this.drawStars(s, playing);
    c.save();
    c.translate(
      w / 2 +
        (s.settings.reduced ? 0 : Math.sin(s.time * 70) * this.shake * 10),
      h / 2 + (s.settings.reduced ? 0 : Math.cos(s.time * 80) * this.shake * 7),
    );
    c.scale(this.scale, this.scale);
    c.translate(-this.cx, -this.cy);
    if (indoor) this.drawInterior(s);
    else if (s.mode === "surface" && playing) this.drawSurface(s);
    else this.drawSpace(s, playing);
    if (playing) {
      if (input.target) {
        c.strokeStyle = "#f6bf72";
        c.lineWidth = 1 / this.scale;
        c.setLineDash([5, 9]);
        c.beginPath();
        c.moveTo(s.x, s.y);
        c.lineTo(input.target.x, input.target.y);
        c.stroke();
        c.setLineDash([]);
        c.beginPath();
        c.arc(input.target.x, input.target.y, 18, 0, Math.PI * 2);
        c.stroke();
      }
      if (indoor || s.mode === "surface" || s.mode === "eva")
        this.person(s.x, s.y, s.angle, s.avatar.suit, s.avatar);
      else
        this.ship(
          s.x,
          s.y,
          s.angle,
          s.ship.color,
          Math.hypot(s.vx, s.vy) > 30,
          s.time,
          1,
          s.ship.accent,
        );
      for (const e of s.enemies) {
        if (Math.hypot(e.x - s.x, e.y - s.y) > 2000) continue;
        if (s.mode === "surface" || s.mode === "derelict")
          this.person(e.x, e.y, e.angle, "#df756b");
        else if (e.boss)
          this.drawBoss(e.x, e.y, e.angle, s.chapter, e.phase, s.time);
        else this.ship(e.x, e.y, e.angle, "#e97e7e", true, s.time, 0.8);
        this.bar(
          e.x,
          e.y - (e.boss ? 90 : 42),
          e.boss ? 160 : 55,
          4,
          e.hp / e.maxHp,
          "#ed8181",
        );
        if (e.boss) this.label(e.name, e.x, e.y - 110, "#f0a39a", 14);
      }
      for (const p of s.projectiles) {
        c.strokeStyle =
          p.owner === "enemy"
            ? "#f67d81"
            : p.weapon === "ion"
              ? "#a097fc"
              : "#81edf0";
        c.lineWidth = p.weapon === "rail" ? 5 : 3;
        c.beginPath();
        c.moveTo(p.x, p.y);
        const len =
          p.weapon === "mine"
            ? 2
            : Math.min(14, Math.hypot(p.vx, p.vy) * 0.018);
        const a = Math.atan2(p.vy, p.vx);
        c.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
        c.stroke();
      }
    }
    if (playing && !s.settings.reduced) {
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        c.globalAlpha = Math.max(0, p.life);
        c.fillStyle = p.color;
        c.fillRect(p.x, p.y, 3, 3);
      }
      c.globalAlpha = 1;
    }
    c.restore();
    if (playing && !indoor && s.mode !== "surface" && w > 740) this.radar(s);
    if (playing && !s.settings.reduced && this.transition > 0) {
      c.fillStyle =
        s.mode === "surface"
          ? `rgba(230,167,112,${this.transition * 0.2})`
          : `rgba(117,192,230,${this.transition * 0.2})`;
      c.fillRect(0, 0, w, h);
      if (s.mode === "space") {
        c.strokeStyle = `rgba(142,216,239,${this.transition * 0.35})`;
        c.lineWidth = 1;
        for (let i = 0; i < 24; i++) {
          const a = (i * Math.PI) / 12;
          c.beginPath();
          c.moveTo(w / 2 + Math.cos(a) * 90, h / 2 + Math.sin(a) * 90);
          c.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * w);
          c.stroke();
        }
      }
    }
  }
  private drawStars(s: State, playing: boolean) {
    const c = this.ctx,
      w = this.width,
      h = this.height;
    const neb = c.createRadialGradient(
      w * 0.72,
      h * 0.4,
      10,
      w * 0.72,
      h * 0.4,
      w * 0.6,
    );
    neb.addColorStop(0, "#14253b");
    neb.addColorStop(0.5, "#0e1828");
    neb.addColorStop(1, "#070c16");
    c.fillStyle = neb;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ccddeb";
    for (const star of this.stars) {
      const x =
          (((star.x - (playing ? s.x * 0.025 : s.time * 1.2)) % w) + w) % w,
        y = (((star.y - s.y * 0.02) % h) + h) % h;
      c.globalAlpha = star.a;
      c.fillRect(x, y, star.size, star.size);
    }
    c.globalAlpha = 1;
    if (!s.settings.reduced) {
      const g = c.createRadialGradient(
        w * 0.3,
        h * 0.5,
        10,
        w * 0.3,
        h * 0.5,
        h * 0.6,
      );
      g.addColorStop(0, "#30304730");
      g.addColorStop(1, "#10102100");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  }
  private drawSpace(s: State, playing: boolean) {
    const c = this.ctx;
    for (const obj of this.galaxy[s.system].contacts) {
      if (playing && Math.hypot(obj.x - s.x, obj.y - s.y) > 1900) continue;
      const known = s.scanned.includes(obj.id);
      if (obj.kind === "planet") this.planet(obj, s.time);
      else if (obj.kind === "station" || obj.kind === "outpost")
        this.station(obj.x, obj.y, obj.radius, s.time);
      else if (obj.kind === "asteroid") {
        const rng = random(hash(obj.id));
        for (let i = 0; i < 12; i++) {
          const x = obj.x + (rng() - 0.5) * 180,
            y = obj.y + (rng() - 0.5) * 180,
            r = 10 + rng() * 20;
          c.fillStyle = i % 3 ? "#434650" : "#62616a";
          c.beginPath();
          for (let j = 0; j < 7; j++) {
            const a = (j * Math.PI * 2) / 7;
            c.lineTo(
              x + Math.cos(a) * r * (0.7 + rng() * 0.3),
              y + Math.sin(a) * r * (0.7 + rng() * 0.3),
            );
          }
          c.closePath();
          c.fill();
        }
      } else if (obj.kind === "derelict") {
        this.ship(obj.x, obj.y, 0.5, "#777b86", false, s.time, 1.2);
        c.fillStyle = "#ffb473";
        c.fillRect(obj.x - 10, obj.y - 2, 5, 5);
      } else {
        c.save();
        c.translate(obj.x, obj.y);
        c.rotate(s.time * 0.2);
        c.strokeStyle = "#9c7ee8";
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.ellipse(0, 0, 25 + i * 11, 10 + i * 4, i, 0, Math.PI * 2);
          c.stroke();
        }
        c.restore();
      }
      if (playing) {
        const mission = s.contracts.find((q) => {
          const target = missionTarget(q);
          return target?.system === s.system && target.location === obj.id;
        });
        if (mission) {
          c.strokeStyle = "#ffb66b";
          c.lineWidth = 2;
          c.beginPath();
          c.arc(obj.x, obj.y, obj.radius + 18, 0, Math.PI * 2);
          c.stroke();
          this.label(
            "◆ " + mission.title,
            obj.x,
            obj.y - obj.radius - 30,
            "#ffb66b",
            12,
          );
        }
        const label = known
          ? obj.name
          : "? " + (obj.kind === "planet" ? "Планета" : "Контакт");
        this.label(
          label,
          obj.x,
          obj.y + obj.radius + 28,
          known ? "#b6c7d5" : "#788b9e",
          12,
        );
        if (known && obj.kind === "planet")
          this.label(
            biomes[obj.biome].name,
            obj.x,
            obj.y + obj.radius + 45,
            "#6e8295",
            10,
          );
      }
    }
    if (s.mode === "eva") {
      this.ship(
        s.orbit.x,
        s.orbit.y,
        s.orbit.angle,
        s.ship.color,
        false,
        s.time,
      );
      this.label(s.ship.name, s.orbit.x, s.orbit.y - 65, "#81dce1", 12);
    }
  }
  private planet(p: Contact, time: number) {
    const c = this.ctx,
      b = biomes[p.biome];
    c.save();
    c.translate(p.x, p.y);
    c.strokeStyle = b.color + "22";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, p.radius + 13, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, p.radius, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(
      -p.radius * 0.5,
      -p.radius * 0.5,
      1,
      10,
      20,
      p.radius * 1.4,
    );
    g.addColorStop(0, b.color);
    g.addColorStop(0.5, b.dark);
    g.addColorStop(1, "#060b14");
    c.fillStyle = g;
    c.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
    const rng = random(hash(p.id));
    for (let i = 0; i < 25; i++) {
      c.fillStyle = i % 2 ? b.color + "32" : "#080f222d";
      c.beginPath();
      c.ellipse(
        (rng() - 0.5) * p.radius * 2,
        (rng() - 0.5) * p.radius * 2,
        rng() * p.radius * 0.45 + 3,
        rng() * p.radius * 0.16 + 2,
        rng() * 3,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    if (p.biome === 2) {
      c.strokeStyle = "#ff9e5670";
      c.beginPath();
      c.moveTo(-60, -70);
      c.lineTo(-15, 0);
      c.lineTo(15, 20);
      c.lineTo(25, 90);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = b.color + "55";
    c.beginPath();
    c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    c.stroke();
    if (p.biome === 8) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(-0.4);
      c.strokeStyle = "#cbbce344";
      c.lineWidth = 8;
      c.beginPath();
      c.ellipse(0, 0, p.radius * 1.55, p.radius * 0.33, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }
  private station(x: number, y: number, r: number, time: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(time * 0.015);
    c.strokeStyle = "#536e80";
    c.lineWidth = 9;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#85dfe3";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, r + 6, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      c.save();
      c.rotate((i * Math.PI) / 3);
      c.fillStyle = "#2b3f52";
      c.fillRect(-8, -r - 12, 16, 27);
      c.fillStyle = "#8ecbd1";
      c.fillRect(-5, -r - 7, 10, 3);
      c.restore();
    }
    c.fillStyle = "#1b2c3e";
    c.strokeStyle = "#6f879a";
    c.lineWidth = 2;
    c.fillRect(-24, -24, 48, 48);
    c.strokeRect(-24, -24, 48, 48);
    c.fillStyle = "#e9b76e";
    c.fillRect(-12, -12, 24, 24);
    c.restore();
    c.strokeStyle = "#eabc75";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x + r + 10, y);
    c.lineTo(x + r + 35, y);
    c.stroke();
  }
  ship(
    x: number,
    y: number,
    a: number,
    color: string,
    thrust: boolean,
    time: number,
    size = 1,
    accent = "#ffbe78",
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.scale(size, size);
    if (thrust) {
      c.fillStyle = color + "55";
      c.beginPath();
      c.moveTo(-26, -9);
      c.lineTo(-48 - Math.sin(time * 40) * 9, 0);
      c.lineTo(-26, 9);
      c.fill();
      c.fillStyle = "#a4e6f7";
      c.beginPath();
      c.moveTo(-25, -4);
      c.lineTo(-36, 0);
      c.lineTo(-25, 4);
      c.fill();
    }
    c.fillStyle = "#253a4c";
    c.strokeStyle = color;
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(34, 0);
    c.lineTo(7, -12);
    c.lineTo(-12, -22);
    c.lineTo(-23, -19);
    c.lineTo(-14, -6);
    c.lineTo(-26, -6);
    c.lineTo(-26, 6);
    c.lineTo(-14, 6);
    c.lineTo(-23, 19);
    c.lineTo(-12, 22);
    c.lineTo(7, 12);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(23, 0);
    c.lineTo(5, -5);
    c.lineTo(2, 5);
    c.closePath();
    c.fill();
    c.fillStyle = "#91aaba";
    c.fillRect(-15, -3, 14, 6);
    c.fillStyle = accent;
    c.fillRect(-16, -17, 6, 3);
    c.fillRect(-16, 14, 6, 3);
    c.restore();
  }
  private person(
    x: number,
    y: number,
    a: number,
    color: string,
    avatar?: State["avatar"],
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.fillStyle = "#04091270";
    c.beginPath();
    c.ellipse(3, 8, 15, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.rotate(a);
    c.fillStyle = "#233647";
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.fillRect(-9, -10, 16, 20);
    c.strokeRect(-9, -10, 16, 20);
    c.fillStyle = avatar && !avatar.helmet ? avatar.skin : color;
    c.beginPath();
    c.arc(3, 0, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#11303b";
    c.fillRect(5, -4, 5, 8);
    if (avatar && !avatar.helmet) {
      c.fillStyle = avatar.hair;
      c.fillRect(-3, -7, 5 + avatar.style * 2, 14);
    }
    c.fillStyle = "#d5cfb4";
    c.fillRect(10, 6, 14, 3);
    c.restore();
  }
  private drawInterior(s: State) {
    const c = this.ctx;
    const station = s.mode === "station";
    c.fillStyle = "#111d2b";
    c.strokeStyle = "#374e64";
    c.lineWidth = 3;
    c.fillRect(-240, -235, 480, 545);
    c.strokeRect(-240, -235, 480, 545);
    for (let x = -230; x < 240; x += 30)
      for (let y = -225; y < 300; y += 30) {
        c.strokeStyle = "#223347";
        c.lineWidth = 0.5;
        c.strokeRect(x, y, 28, 28);
      }
    c.fillStyle = "#2b3a4966";
    c.fillRect(-35, -220, 70, 500);
    c.fillRect(-230, -35, 460, 70);
    c.fillRect(-230, 115, 460, 70);
    const points = station ? stationPoints : s.ship.modules;
    for (const m of points) {
      const module = "integrity" in m ? (m as Module) : undefined;
      const bad =
        module && (module.integrity < 80 || module.breach || module.fire > 0);
      const w = m.id === "cockpit" || m.id === "bar" ? 170 : 130,
        h = m.id === "airlock" || m.id === "dock" ? 65 : 105;
      c.fillStyle = bad ? "#442b33" : "#1b2c3e";
      c.strokeStyle = bad ? "#a46462" : "#3c6175";
      c.lineWidth = 1.5;
      c.fillRect(m.x - w / 2, m.y - h / 2, w, h);
      c.strokeRect(m.x - w / 2, m.y - h / 2, w, h);
      c.fillStyle = bad ? "#e78268" : s.ship.color;
      c.fillRect(m.x - w / 2 + 10, m.y - h / 2 + 7, w - 20, 2);
      const title = m.name.split(" · ")[0];
      this.label(title, m.x, m.y + h / 2 + 15, "#93aab9", 10);
      if (station && m.id !== "dock") {
        this.person(
          m.x + 25,
          m.y - 10,
          Math.PI,
          ["#e8b974", "#a9c8b3", "#bdabdf", "#79bfd5", "#99d5e0"][
            points.indexOf(m) % 5
          ],
        );
        this.label("NPC", m.x + 25, m.y + 12, "#b3c9ce", 9);
      } else {
        c.fillStyle = "#31485b";
        c.fillRect(m.x - 30, m.y - 20, 60, 38);
        c.strokeStyle = "#7693a8";
        c.strokeRect(m.x - 30, m.y - 20, 60, 38);
        c.fillStyle = bad ? "#e7a16e" : "#75c9d4";
        for (let j = 0; j < 3; j++)
          c.fillRect(m.x - 22 + j * 18, m.y - 12, 12, 4);
        if (module) {
          this.bar(
            m.x,
            m.y + 27,
            65,
            3,
            module.integrity / 100,
            bad ? "#e89b77" : "#6cbdc8",
          );
          if (module.breach) {
            c.fillStyle = "#080b10";
            c.beginPath();
            c.arc(m.x + 45, m.y, 13, 0, 6.3);
            c.fill();
            c.strokeStyle = "#ed8372";
            c.stroke();
          }
          if (module.fire > 0) {
            c.fillStyle = "#fbc57a";
            c.beginPath();
            c.arc(m.x, m.y, 13 + Math.sin(s.time * 9) * 4, 0, 6.3);
            c.fill();
          }
        }
      }
    }
    if (s.mode === "derelict") {
      c.fillStyle = "#03060b77";
      c.fillRect(-240, -235, 480, 545);
      c.fillStyle = "#e6b477";
      c.fillRect(-14, -15, 28, 20);
      this.label("ТЕРМИНАЛ", 0, -32, "#e6b477", 11);
    }
    this.label(
      station ? "ОРБИТАЛЬНЫЙ ПОРТ" : s.ship.name,
      0,
      -260,
      "#6d8da0",
      12,
    );
  }
  private drawSurface(s: State) {
    const p = currentPlanet(s);
    if (!p) return;
    const c = this.ctx,
      b = biomes[p.biome];
    c.fillStyle = b.dark;
    c.fillRect(-1200, -1100, 2400, 2200);
    const rng = random(hash(s.seed + p.id));
    for (let i = 0; i < 220; i++) {
      const x = (rng() - 0.5) * 2300,
        y = (rng() - 0.5) * 2100;
      if (Math.abs(x - s.x) > 1100 || Math.abs(y - s.y) > 800) continue;
      const r = 2 + rng() * 19;
      c.fillStyle = b.color + (i % 3 ? "10" : "22");
      c.beginPath();
      c.ellipse(x, y, r * 2, r, rng() * 3, 0, 6.3);
      c.fill();
    }
    c.strokeStyle = b.color + "20";
    c.lineWidth = 2;
    c.strokeRect(-1050, -950, 2100, 1900);
    let nodes = this.surfaceCache.get(p.id);
    if (!nodes) {
      nodes = generateSurface(s.seed, p);
      this.surfaceCache.set(p.id, nodes);
    }
    for (const n of nodes) {
      if (
        n.kind !== "ship" &&
        n.kind !== "ruin" &&
        (s.depleted[n.id] ?? 0) >= n.amount
      )
        continue;
      if (Math.abs(n.x - s.x) > 1000 || Math.abs(n.y - s.y) > 800) continue;
      if (n.kind === "ship") {
        this.ship(n.x, n.y, -Math.PI / 2, s.ship.color, false, s.time, 1.8);
        this.label("ПОСАДОЧНЫЙ МОДУЛЬ", n.x, n.y + 65, "#9ddde3", 11);
      } else if (n.kind === "ruin") {
        c.fillStyle = "#3c4053";
        c.strokeStyle = "#a8a1e1";
        c.lineWidth = 2;
        c.fillRect(n.x - 42, n.y - 35, 84, 70);
        c.strokeRect(n.x - 42, n.y - 35, 84, 70);
        c.fillStyle = "#8889d2";
        c.fillRect(n.x - 7, n.y - 20, 14, 40);
        c.strokeStyle = "#a5b9e9";
        c.beginPath();
        c.arc(n.x, n.y, 65, 0, 6.3);
        c.stroke();
        this.label("АРХИВ ХОРА", n.x, n.y - 80, "#c0b3ee", 12);
      } else if (n.kind === "plant") {
        c.fillStyle = "#517a63";
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.arc(
            n.x + Math.cos(i * 2) * 10,
            n.y + Math.sin(i * 2) * 10,
            13,
            0,
            6.3,
          );
          c.fill();
        }
      } else if (n.kind === "wreck") {
        this.ship(n.x, n.y, 0.9, "#888478", false, s.time);
      } else {
        c.fillStyle = n.kind === "cave" ? "#080d16" : items[n.resource].color;
        c.strokeStyle = "#92a1b466";
        c.beginPath();
        c.moveTo(n.x - 18, n.y + 10);
        c.lineTo(n.x - 10, n.y - 15);
        c.lineTo(n.x + 6, n.y - 22);
        c.lineTo(n.x + 22, n.y + 8);
        c.closePath();
        c.fill();
        c.stroke();
      }
      if (n.kind !== "ship" && n.kind !== "ruin")
        this.label(
          items[n.resource].name,
          n.x,
          n.y + 34,
          items[n.resource].color,
          10,
        );
    }
    this.label(
      `${p.name.toUpperCase()} / ${b.name.toUpperCase()}`,
      s.x,
      s.y - 350,
      b.color,
      14,
    );
  }
  private drawBoss(
    x: number,
    y: number,
    a: number,
    index: number,
    phase: number,
    time: number,
  ) {
    const c = this.ctx;
    if (index === 0 || index === 3) {
      this.ship(x, y, a, index === 0 ? "#e59d77" : "#c1abd7", true, time, 2.5);
      if (index === 3) {
        this.ship(x + 80, y + 90, a, "#927ca8", false, time);
        this.ship(x - 80, y - 90, a, "#927ca8", false, time);
      }
    } else if (index === 1) this.station(x, y, 80, time * 4);
    else {
      c.save();
      c.translate(x, y);
      c.rotate(time * 0.15);
      c.strokeStyle = index === 2 ? "#ba84bf" : "#a297eb";
      c.fillStyle = "#392b4c";
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6,
          r = i % 2 ? 38 : 65 + Math.sin(time + i) * 8;
        c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = "#eed2ff";
      c.beginPath();
      c.arc(0, 0, 12 + phase * 3, 0, 6.3);
      c.fill();
      c.restore();
    }
  }
  private bar(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    color: string,
  ) {
    const c = this.ctx;
    c.fillStyle = "#0d1522";
    c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = color;
    c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, value)), h);
  }
  private label(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number,
  ) {
    const c = this.ctx;
    c.font = `${size}px "Segoe UI", sans-serif`;
    c.textAlign = "center";
    c.fillStyle = "#070c16aa";
    const width = c.measureText(text).width;
    c.fillRect(x - width / 2 - 4, y - size, width + 8, size + 5);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  private radar(s: State) {
    const c = this.ctx,
      x = this.width - 110,
      y = this.height - 210,
      r = 70,
      range = has(s, "radar") ? 2600 : 1300;
    c.fillStyle = "#0a1423dd";
    c.strokeStyle = "#486175";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, y, r, 0, 6.3);
    c.fill();
    c.stroke();
    c.strokeStyle = "#284052";
    for (let i = 1; i < 3; i++) {
      c.beginPath();
      c.arc(x, y, (r * i) / 3, 0, 6.3);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(x - r, y);
    c.lineTo(x + r, y);
    c.moveTo(x, y - r);
    c.lineTo(x, y + r);
    c.stroke();
    for (const p of [
      ...this.galaxy[s.system].contacts,
      ...s.enemies,
      ...s.projectiles.filter((p) => p.owner === "enemy"),
    ]) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d > range) continue;
      c.fillStyle =
        "hp" in p
          ? "#f18b8b"
          : "kind" in p
            ? p.kind === "planet"
              ? "#9cafbd"
              : p.kind === "station"
                ? "#e5bd7b"
                : "#9e93db"
            : "#f69b6f";
      c.fillRect(
        x + ((p.x - s.x) / range) * r - 2,
        y + ((p.y - s.y) / range) * r - 2,
        4,
        4,
      );
    }
    c.fillStyle = "#82e1e3";
    c.fillRect(x - 2, y - 2, 4, 4);
    c.font = "9px monospace";
    c.textAlign = "center";
    c.fillStyle = "#7a96aa";
    c.fillText(`РАДАР / ${range} м`, x, y + r + 18);
  }
}
