import { chromium, webkit, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base =
  process.env.GAME_URL || "http://localhost:4173/STARFALL-VOID-FRONTIER/";
await mkdir("test-results", { recursive: true });
const failures = [];
for (const [name, type, options] of [
  ["desktop", chromium, { viewport: { width: 1440, height: 1000 } }],
  ["iphone-webkit", webkit, { ...devices["iPhone 13"] }],
]) {
  const browser = await type.launch({ headless: true }),
    page = await browser.newPage(options),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.screenshot({ path: `test-results/${name}-title.png` });
    await page.locator('[data-action="new"]').click();
    const read = async () => {
      await page.locator('.header-actions [data-action="save"]').click();
      return page.evaluate(() =>
        JSON.parse(
          JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
        ),
      );
    };
    const panel = async (id) => {
      if (!(await page.locator("#modal").isVisible()))
        await page.locator('.header-actions [data-action="panel"]').click();
      await page.locator(`.menu-tabs [data-param="${id}"]`).click();
    };
    const close = async () => {
      if (await page.locator("#modal").isVisible())
        await page.locator('.menu-footer [data-action="close"]').click();
    };
    async function waitUntil(predicate, seconds = 20) {
      for (let i = 0; i < seconds * 2; i++) {
        await page.waitForTimeout(500);
        const s = await read();
        if (predicate(s)) return s;
      }
      throw new Error(`World condition timed out after ${seconds}s`);
    }
    async function module(id) {
      await panel("ship");
      await page
        .locator(`[data-action="navigate"][data-param="${id}"]`)
        .click();
      const target=(await read()).ship.modules.find(m=>m.id===id);
      await waitUntil(s=>Math.hypot(s.x-target.x,s.y-target.y)<55,12);
      await page.locator("#interact-button").click();
      if (!["cockpit", "airlock"].includes(id) || (await read()).activity)
        await waitUntil((s) => !s.activity, 8);
    }
    for (const id of ["fabricator", "airlock", "reactor", "engine", "cockpit"])
      await module(id);
    let s = await read();
    if (s.intro !== 4 || s.mode !== "space" || s.physical !== true)
      throw Error("Physical introduction failed");
    console.log(`${name}: timed physical introduction passed`);
    async function dock(id) {
      await panel("port");
      await page
        .locator(`[data-action="requestDock"][data-param="${id}"]`)
        .click();
      await page
        .locator(`[data-action="navigate"][data-param="${id}"]`)
        .click();
      await page.waitForTimeout(7500);
      await page.locator("#interact-button").click();
      const captured = await read();
      if (captured.docking.phase !== "sealing")
        throw Error(`Capture failed: ${captured.logs[0]}`);
      if (captured.mode !== "space")
        throw Error("Docking teleported into station");
      await waitUntil((s) => s.docking.phase === "ready", 10);
      await page.locator('[data-action="board"]').click();
      await module("airlock");
      await panel("port");
      await page
        .locator('[data-action="navigate"][data-param="station-airlock"]')
        .click();
      await page.waitForTimeout(2500);
      await page.locator("#interact-button").click();
      const entered = await read();
      if (
        entered.mode !== "station" ||
        !entered.docking.shipDoor ||
        !entered.docking.stationDoor
      )
        throw Error("Physical airlock traversal failed");
    }
    async function visit(role) {
      await panel("port");
      await page
        .locator(`[data-action="navigate"][data-param$=":${role}"]`)
        .click();
      await waitUntil(
        (s) =>
          s.residents.some(
            (n) =>
              n.port === s.location &&
              n.role === role &&
              Math.hypot(n.x - s.x, n.y - s.y) < 55,
          ),
        18,
      );
      await page.locator("#interact-button").click();
    }
    async function leave() {
      await panel("port");
      await page
        .locator('[data-action="navigate"][data-param="station-airlock"]')
        .click();
      await page.waitForTimeout(9000);
      await page.locator("#interact-button").click();
      await panel("port");
      await page
        .locator('[data-action="navigate"][data-param="ship-airlock"]')
        .click();
      await page.waitForTimeout(2500);
      await page.locator("#interact-button").click();
      if ((await read()).mode !== "interior")
        throw Error("Failed to return physically into ship");
      await module("cockpit");
      await panel("port");
      await page.locator('[data-action="releaseDock"]').click();
      await close();
      if ((await read()).docking.phase !== "none")
        throw Error("Magnetic clamps not released");
    }
    await page.locator('[data-action="scan"]').click();
    await dock("0-s");
    await panel("trade");
    if (
      await page.locator('[data-action="buy"][data-param="iron"]').isEnabled()
    )
      throw Error("Remote market transaction exposed");
    await close();
    await visit("bar");
    await page.locator('[data-action="askLore"]').click();
    await close();
    s = await read();
    if (
      !s.codex.some((e) => e.includes("WELCOME BACK")) ||
      !s.residents.some(
        (n) => n.role === "bar" && n.met && n.memories.length >= 2,
      )
    )
      throw Error("Lore conversation/memory missing");
    await visit("contracts");
    await panel("quests");
    await page.locator('[data-action="accept"][data-param="0-mining"]').click();
    await page.locator('[data-action="claim"][data-param="0-mining"]').click();
    await page
      .locator('[data-action="accept"][data-param="0-delivery"]')
      .click();
    if (
      await page
        .locator('[data-action="claim"][data-param="0-delivery"]')
        .isEnabled()
    )
      throw Error("Freight claim allowed at origin");
    await close();
    await visit("trade");
    await panel("trade");
    await page.locator('[data-action="buy"][data-param="iron"]').click();
    await close();
    await visit("tech");
    await panel("tech");
    await page
      .locator('[data-action="upgrade"][data-param="shield-0"]')
      .click();
    await panel("ship");
    await page.locator('[data-action="service"]').click();
    s = await read();
    if (!s.maintenance || s.maintenance.progress !== 0)
      throw Error("Engineering still instant");
    const engineer = s.residents.find((n) => n.id === s.maintenance.worker),
      startY = engineer.y;
    await page.waitForTimeout(4000);
    s = await read();
    if (s.residents.find((n) => n.id === engineer.id).y === startY)
      throw Error("Engineer did not walk");
    await page.screenshot({ path: `test-results/${name}-station.png` });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-action="continue"]').click();
    s = await read();
    if (!s.maintenance) throw Error("Reload lost active engineer job");
    await waitUntil((s) => s.maintenance === null, 140);
    console.log(
      `${name}: station NPCs, lore, physical engineer and reload passed`,
    );
    await panel("encounters");
    await page
      .locator(
        '[data-action="encounterChoice"][data-param="inspection:0|declare"]',
      )
      .click();
    await page.screenshot({ path: `test-results/${name}-encounters.png` });
    await close();
    s = await read();
    if (s.encounters.find((e) => e.id === "inspection:0").choice !== "declare")
      throw Error("Inspection decision missing");
    await leave();
    await panel("galaxy");
    await page.locator('[data-system="1"]').click();
    await page.locator('[data-action="jump"][data-param="1"]').click();
    await dock("1-s");
    await visit("contracts");
    await panel("quests");
    await page
      .locator('[data-action="claim"][data-param="0-delivery"]')
      .click();
    await close();
    s = await read();
    if (!s.contracts.find((q) => q.id === "0-delivery").complete)
      throw Error("Real freight delivery failed");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-action="continue"]').click();
    s = await read();
    if (
      s.version !== 6 ||
      s.location !== "1-s" ||
      s.bosses.length !== 0 ||
      !s.chronicle.length
    )
      throw Error("Saved independent captain journey mismatch");
    await page.screenshot({ path: `test-results/${name}-journey.png` });
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      `${name}: PASS New Game → physical repair/docking/airlocks → named NPC/lore → engineer walk/repair/reload → departure → actual freight → saved sandbox without boss progression`,
    );
  } catch (e) {
    const context=await page.evaluate(()=>{const raw=localStorage.getItem("starfall-save-v1-0");if(!raw)return null;const s=JSON.parse(JSON.parse(raw).payload);return {mode:s.mode,x:s.x,y:s.y,docking:s.docking,activity:s.activity,logs:s.logs.slice(0,3)};}).catch(()=>null);
    failures.push(`${name}: ${e.stack || e}\nState: ${JSON.stringify(context)}`);
    await page
      .screenshot({ path: `test-results/${name}-failure.png` })
      .catch(() => {});
  } finally {
    await browser.close();
  }
}
if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
}
