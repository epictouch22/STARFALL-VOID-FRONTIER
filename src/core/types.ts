import type { EscortShip } from "./escort";
export type Mode =
  "interior" | "space" | "surface" | "station" | "eva" | "derelict";
export type Wound =
  | "cut"
  | "burn"
  | "fracture"
  | "cold"
  | "toxin"
  | "radiation"
  | "puncture"
  | "bruise"
  | "suffocation";
export type BodyPart = {
  name: string;
  health: number;
  wounds: Partial<Record<Wound, number>>;
};
export type Health = {
  parts: BodyPart[];
  blood: number;
  oxygen: number;
  pain: number;
  radiation: number;
  temperature: number;
  consciousness: number;
  hunger: number;
  stimulant: number;
};
export type Module = {
  id: string;
  name: string;
  x: number;
  y: number;
  integrity: number;
  fire: number;
  breach: boolean;
};
export type Enemy = {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  cooldown: number;
  kind: string;
  phase: number;
  disabled: number;
  boss: boolean;
};
export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  owner: "player" | "enemy";
  weapon: string;
};
export type MissionPort = { system: number; location: string };
export type ContractMission = {
  origin: MissionPort;
  destination: MissionPort;
  pickup: MissionPort | null;
  stage: "pickup" | "delivery" | "done" | "cancelled" | "failed";
  manifest: { label: string; weight: number; slots: number };
  escort: EscortShip | null;
};
export type Contract = {
  id: string;
  type:
    | "mining"
    | "hunt"
    | "survey"
    | "delivery"
    | "salvage"
    | "repair"
    | "passenger"
    | "rescue"
    | "escort";
  title: string;
  item: string;
  target: number;
  progress: number;
  reward: number;
  faction: number;
  complete: boolean;
  mission: ContractMission | null;
};
export type State = {
  version: 4;
  pack: Record<string, number>;
  quickSlots: string[];
  avatar: {
    skin: string;
    suit: string;
    hair: string;
    style: number;
    helmet: boolean;
  };
  orbit: { x: number; y: number; angle: number; active: boolean };
  seed: string;
  slot: number;
  name: string;
  mode: Mode;
  system: number;
  location: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  credits: number;
  inventory: Record<string, number>;
  health: Health;
  ship: {
    class: string;
    name: string;
    color: string;
    accent: string;
    hull: number;
    shield: number;
    energy: number;
    fuel: number;
    ammo: number;
    heat: number;
    weapon: string;
    modules: Module[];
  };
  discovered: number[];
  scanned: string[];
  depleted: Record<string, number>;
  upgrades: string[];
  reputation: number[];
  contracts: Contract[];
  kills: string[];
  bosses: number[];
  chapter: number;
  evidence: number[];
  intro: number;
  docked: boolean;
  ending: string;
  codex: string[];
  logs: string[];
  time: number;
  stats: { mined: number; kills: number; jumps: number };
  eventClock: number;
  eventIndex: number;
  settings: {
    mute: boolean;
    sfx: number;
    music: number;
    reduced: boolean;
    uiScale: number;
    stickSize: number;
    opacity: number;
    sensitivity: number;
  };
  enemies: Enemy[];
  projectiles: Projectile[];
  cooldown: number;
};
