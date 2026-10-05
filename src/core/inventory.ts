import { items } from "../data/catalog";
import type { State } from "./types";
import { shipStats } from "./state";
export const inventoryWeight = (pool: Record<string, number>) =>
  Object.entries(pool).reduce(
    (n, [id, q]) => n + (items[id]?.weight ?? 1) * q,
    0,
  );
export const inventorySlots = (pool: Record<string, number>) =>
  Object.values(pool).reduce((n, q) => n + Math.ceil(q / 99), 0);
export function transfer(s: State, id: string, toPack: boolean, n = 1) {
  if (
    !["space", "interior", "station"].includes(s.mode) ||
    !Number.isInteger(n) ||
    n < 1 ||
    !items[id]
  )
    return false;
  const source = toPack ? s.inventory : s.pack,
    dest = toPack ? s.pack : s.inventory;
  if ((source[id] ?? 0) < n) return false;
  const next = { ...dest, [id]: (dest[id] ?? 0) + n };
  if (
    inventoryWeight(next) > (toPack ? 35 : shipStats(s).cargo) ||
    inventorySlots(next) > (toPack ? 12 : 40)
  )
    return false;
  source[id] -= n;
  if (!source[id]) delete source[id];
  dest[id] = (dest[id] ?? 0) + n;
  return true;
}
export function unloadResources(s: State) {
  for (const id of Object.keys(s.pack))
    if (items[id]?.kind === "resource") transfer(s, id, false, s.pack[id]);
}
