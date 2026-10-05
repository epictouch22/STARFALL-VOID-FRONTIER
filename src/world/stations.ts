import { generateGalaxy, hash, random } from "./galaxy";
export type Facility =
  "trade" | "contracts" | "medical" | "tech" | "bar" | "habitation";
export type StationRoom = {
  id: Facility;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};
function createStation(seed: string, port: string) {
  const rng = random(hash(`${seed}:${port}:station`));
  const industry = [
    "Шахтёрская артель",
    "Перевалочный порт",
    "Научный аванпост",
    "Ремонтная верфь",
  ][Math.floor(rng() * 4)];
  const roomIds: Facility[] = [
    "trade",
    "contracts",
    "medical",
    "tech",
    "bar",
    "habitation",
  ];
  // Vary placement while preserving connected hallways and stable facility identities.
  if (rng() > 0.5) [roomIds[0], roomIds[1]] = [roomIds[1], roomIds[0]];
  if (rng() > 0.5) [roomIds[2], roomIds[3]] = [roomIds[3], roomIds[2]];
  const labels = {
    trade: "РЫНОК / СКЛАД",
    contracts: "ГИЛЬДИЯ КАПИТАНОВ",
    medical: "КЛИНИКА",
    tech: "ИНЖЕНЕРНЫЙ ЦЕХ",
    bar: "БАР / ОБЩАЯ КОМНАТА",
    habitation: "ЖИЛОЙ БЛОК",
  };
  const rooms: StationRoom[] = roomIds.map((id, i) => ({
    id,
    name: labels[id],
    x: i % 2 ? 190 : -190,
    y: 650 + Math.floor(i / 2) * 260,
    width: 270,
    height: 200,
    color:
      id === "medical"
        ? "#548d80"
        : id === "tech"
          ? "#c19759"
          : id === "bar"
            ? "#906987"
            : "#557387",
  }));
  return {
    industry,
    founded: 2370 + Math.floor(rng() * 120),
    rooms,
    history: [
      "[МЕМОРИАЛ] Во время Frontier War, 2421–2429, этот порт принимал эвакуационные суда. Имена погибших остаются на стене шлюза.",
      "[МЕСТНАЯ ХРОНИКА] Во время Blackwake Years порт лишился трёх торговых рейсов. Выжившие создали кооператив ремонта.",
      "[ОФИЦИАЛЬНО] После Corporate Secession 2454 года оборудование станции арендуется у Helix. Местные жители оспаривают условия.",
    ][Math.floor(rng() * 3)],
  };
}
export function stationContact(seed: string, port: string) {
  const system = Number(port.split("-")[0]);
  return generateGalaxy(seed)[system]?.contacts.find(
    (c) => c.id === port && ["station", "outpost"].includes(c.kind),
  );
}
export function stationFloor(seed: string, port: string, x: number, y: number) {
  const inside = (cx: number, cy: number, w: number, h: number) =>
    Math.abs(x - cx) <= w / 2 - 8 && Math.abs(y - cy) <= h / 2 - 8;
  if (
    inside(0, 35, 480, 560) ||
    inside(0, 470, 96, 350) ||
    inside(0, 910, 110, 760)
  )
    return true;
  return stationLayout(seed, port).rooms.some(
    (r) => inside(r.x, r.y, r.width, r.height) || inside(r.x / 2, r.y, 210, 80),
  );
}

const layoutCache = new Map<string, ReturnType<typeof createStation>>();
export function stationLayout(seed: string, port: string) {
  const id = `${seed}:${port}`;
  let value = layoutCache.get(id);
  if (!value) {
    value = createStation(seed, port);
    if (layoutCache.size >= 128) layoutCache.clear();
    layoutCache.set(id, value);
  }
  return value;
}
