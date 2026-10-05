import { chromium, webkit, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base =
  process.env.GAME_URL || "http://localhost:4173/STARFALL-VOID-FRONTIER/";
await mkdir("test-results", { recursive: true });
const failures = [];
for (const [name, browserType, options] of [
  ["desktop", chromium, { viewport: { width: 1440, height: 1000 } }],
  ["iphone-webkit", webkit, { ...devices["iPhone 13"] }],
]) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage(options);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.screenshot({ path: `test-results/${name}-title.png` });
    await page.locator('[data-action="new"]').click();
    async function moveTo(module) {
      await page.locator('.header-actions [data-action="panel"]').click();
      await page
        .locator(`[data-action="navigate"][data-param="${module}"]`)
        .click();
      await page.waitForTimeout(2600);
      await page.locator("#interact-button").click();
    }
    for (const module of [
      "fabricator",
      "airlock",
      "reactor",
      "engine",
      "cockpit",
    ])
      await moveTo(module);
    await page.locator('[data-action="scan"]').click();
    await page.locator('.quick-nav [data-param="galaxy"]').click();
    await page.locator('[data-action="navigate"][data-param="0-s"]').click();
    await page.waitForTimeout(6500);
    await page.locator("#interact-button").click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/${name}-game.png` });
    const system = await page.locator("#system-name").innerText();
    if (!system.includes("СТЫКОВКА"))
      throw new Error(`Docking failed: ${system}`);
    await page.locator('.quick-nav [data-param="inventory"]').click();
    await page.locator('[data-action="use"][data-param="fuel"]').click();
    await page
      .locator('.menu-tabs [data-action="panel"][data-param="medical"]')
      .click();
    await page.screenshot({ path: `test-results/${name}-medical.png` });
    await page
      .locator('.menu-tabs [data-action="panel"][data-param="trade"]')
      .click();
    await page.locator('[data-action="buy"][data-param="iron"]').click();
    await page
      .locator('.menu-tabs [data-action="panel"][data-param="quests"]')
      .click();
    await page.locator('[data-action="accept"]').first().click();
    await page
      .locator('[data-action="accept"][data-param="0-delivery"]')
      .click();
    await page
      .locator('[data-action="accept"][data-param="0-passenger"]')
      .click();
    if (
      await page
        .locator('[data-action="claim"][data-param="0-delivery"]')
        .isEnabled()
    )
      throw new Error("Delivery can be claimed at origin");
    await page.screenshot({ path: `test-results/${name}-missions.png` });
    await page
      .locator('.menu-tabs [data-action="panel"][data-param="settings"]')
      .click();
    await page.locator('#modal [data-action="save"]').click();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
    );
    const state = JSON.parse(saved);
    if (
      state.intro !== 4 ||
      state.mode !== "station" ||
      state.contracts.length !== 3 ||
      state.version !== 3
    )
      throw new Error("Saved progress mismatch");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-action="continue"]').click();
    if (!(await page.locator("#system-name").innerText()).includes("СТЫКОВКА"))
      throw new Error("Reload lost location");
    await page.locator('.header-actions [data-action="panel"]').click();
    await page.locator('.menu-tabs [data-param="tech"]').click();
    await page
      .locator('[data-action="upgrade"][data-param="shield-0"]')
      .click();
    await page.locator('.menu-footer [data-action="close"]').click();
    await page.locator("#interact-button").click();
    // Follow the real mission route after save/reload and return to the campaign system.
    // The browser test never writes save data or invokes debug actions.
    await page.locator('.quick-nav [data-param="quests"]').click();
    await page
      .locator('[data-action="missionRoute"][data-param="0-delivery"]')
      .click();
    if (!(await page.locator(".mission-map-marker").count()))
      throw new Error("Missing mission route marker");
    await page.locator('[data-action="jump"][data-param="1"]').click();
    await page.locator('.quick-nav [data-param="galaxy"]').click();
    await page.locator('[data-action="navigate"][data-param="1-s"]').click();
    await page.waitForTimeout(6500);
    await page.locator("#interact-button").click();
    await page.locator('.quick-nav [data-param="quests"]').click();
    await page
      .locator('[data-action="claim"][data-param="0-delivery"]')
      .click();
    await page
      .locator('[data-action="claim"][data-param="0-passenger"]')
      .click();
    if (
      await page
        .locator('[data-action="claim"][data-param="0-delivery"]')
        .isEnabled()
    )
      throw new Error("Duplicate delivery reward available");
    await page.screenshot({ path: `test-results/${name}-delivery.png` });
    await page.locator('.menu-footer [data-action="close"]').click();
    await page.locator('.header-actions [data-action="save"]').click();
    const delivery = await page.evaluate(() =>
      JSON.parse(
        JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
      ),
    );
    if (
      !delivery.contracts
        .filter((q) => ["delivery", "passenger"].includes(q.type))
        .every((q) => q.complete && q.mission.stage === "done")
    )
      throw new Error("Mission state did not persist");
    await page.locator("#interact-button").click();
    await page.locator('.quick-nav [data-param="galaxy"]').click();
    await page.locator('[data-system="0"]').click();
    await page.locator('[data-action="jump"][data-param="0"]').click();
    await page.locator('.quick-nav [data-param="galaxy"]').click();
    await page.locator('[data-action="navigate"][data-param="0-p0"]').click();
    await page.waitForTimeout(7500);
    await page.locator("#interact-button").click();
    await page.waitForTimeout(300);
    if (
      !(await page.locator("#system-name").innerText()).includes("ПОВЕРХНОСТЬ")
    )
      throw new Error("Landing failed");
    // Navigate using the actual scene coordinates and canvas scale, then interact.
    const size = page.viewportSize(),
      scale = size.width < 700 ? 0.58 : 0.85;
    await page.locator("#world").click({
      position: {
        x: size.width / 2 + 320 * scale,
        y: size.height / 2 - 200 * scale,
      },
    });
    await page.waitForTimeout(3400);
    await page.locator("#interact-button").click();
    await page.locator('.header-actions [data-action="save"]').click();
    const surface = await page.evaluate(() =>
      JSON.parse(
        JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
      ),
    );
    if (!surface.evidence.includes(0) || !surface.pack.exo)
      throw new Error(
        "Ruin scan did not persist story evidence in suit inventory",
      );
    await page.screenshot({ path: `test-results/${name}-surface.png` });
    await page.locator('.quick-nav [data-param="inventory"]').click();
    await page.locator('[data-action="quick"][data-param="3"]').click();
    await page.locator('.menu-footer [data-action="close"]').click();
    // A real pointer drag exercises the same capture/cancel path used by the touch sticks.
    if (name === "iphone-webkit") {
      const box = await page.locator("#stick-left").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
      await page.waitForTimeout(500);
      await page.mouse.up();
    }
    await page.locator('[data-action="board"]').click();
    await page.waitForTimeout(4200);
    await page.locator("#interact-button").click();
    await page.waitForTimeout(300);
    if (
      !(await page.locator("#system-name").innerText()).includes(
        "СВОБОДНЫЙ ПОЛЁТ",
      )
    )
      throw new Error("Takeoff failed");
    await page.locator('.quick-nav [data-param="quests"]').click();
    await page.locator('[data-action="boss"]').click();
    if (name === "iphone-webkit") {
      const box = await page.locator("#stick-right").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * 0.88,
        box.y + box.height * 0.442,
      );
      await page.waitForTimeout(8500);
      await page.mouse.up();
    } else {
      await page.mouse.move(
        size.width / 2 + 500 * scale,
        size.height / 2 - (500 * scale * 100) / 650,
      );
      await page.keyboard.down("Space");
      await page.waitForTimeout(8500);
      await page.keyboard.up("Space");
    }
    await page.locator('.header-actions [data-action="save"]').click();
    const victory = await page.evaluate(() =>
      JSON.parse(
        JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
      ),
    );
    if (victory.chapter !== 1 || !victory.bosses.includes(0))
      throw new Error(
        `First boss combat failed: chapter ${victory.chapter}, mode ${victory.mode}, hull ${victory.ship.hull}`,
      );
    await page.screenshot({ path: `test-results/${name}-boss-victory.png` });
    const readSaved = async () => {
      await page.locator('.header-actions [data-action="save"]').click();
      return page.evaluate(() =>
        JSON.parse(
          JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
        ),
      );
    };
    // Complete the remaining four chapters through the production UI.
    // Saved state is read only to aim the controls and assert results.
    for (let chapter = 1; chapter < 5; chapter++) {
      await page.locator('.quick-nav [data-param="galaxy"]').click();
      await page.locator(`[data-system="${chapter * 5}"]`).click();
      await page
        .locator(`[data-action="jump"][data-param="${chapter * 5}"]`)
        .click();
      await page.locator('.quick-nav [data-param="galaxy"]').click();
      await page
        .locator(`[data-action="navigate"][data-param="${chapter * 5}-s"]`)
        .click();
      await page.waitForTimeout(6500);
      await page.locator("#interact-button").click();
      if (
        !(await page.locator("#system-name").innerText()).includes("СТЫКОВКА")
      )
        throw new Error(`Chapter ${chapter} docking failed`);
      await page.locator('.header-actions [data-action="panel"]').click();
      if (chapter === 1) {
        await page.locator('.menu-tabs [data-param="quests"]').click();
        await page
          .locator('[data-action="claim"][data-param="0-mining"]')
          .click();
        await page.locator('.menu-tabs [data-param="tech"]').click();
        for (const id of [
          "hull-0",
          "hull-1",
          "shield-1",
          "weapon-0",
          "weapon-1",
          "weapon-2",
        ])
          await page
            .locator(`[data-action="upgrade"][data-param="${id}"]`)
            .click();
        await page.locator('.menu-tabs [data-param="ship"]').click();
        await page.locator('[data-action="weapon"][data-param="rail"]').click();
      }
      await page.locator('[data-action="service"]').click();
      await page.locator('.menu-footer [data-action="close"]').click();
      await page.locator("#interact-button").click();
      await page.locator('.quick-nav [data-param="galaxy"]').click();
      await page
        .locator(`[data-action="navigate"][data-param="${chapter * 5}-p0"]`)
        .click();
      await page.waitForTimeout(7500);
      await page.locator("#interact-button").click();
      if (
        !(await page.locator("#system-name").innerText()).includes(
          "ПОВЕРХНОСТЬ",
        )
      )
        throw new Error(`Chapter ${chapter} landing failed`);
      await page
        .locator("#world")
        .click({
          position: {
            x: size.width / 2 + 320 * scale,
            y: size.height / 2 - 200 * scale,
          },
        });
      await page.waitForTimeout(3400);
      await page.locator("#interact-button").click();
      await page.locator('[data-action="board"]').click();
      await page.waitForTimeout(4200);
      await page.locator("#interact-button").click();
      await page.locator('.quick-nav [data-param="quests"]').click();
      await page.locator('[data-action="boss"]').click();
      let combat = await readSaved();
      for (
        let second = 0;
        second < 90 && combat.chapter === chapter && combat.mode === "space";
        second++
      ) {
        const enemy = combat.enemies.find((e) => e.boss);
        if (!enemy) throw new Error(`Missing boss at chapter ${chapter}`);
        const angle = Math.atan2(enemy.y - combat.y, enemy.x - combat.x);
        if (name === "iphone-webkit") {
          const box = await page.locator("#stick-right").boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(
            box.x + box.width / 2 + Math.cos(angle) * box.width * 0.42,
            box.y + box.height / 2 + Math.sin(angle) * box.height * 0.42,
          );
          await page.waitForTimeout(1000);
          await page.mouse.up();
        } else {
          await page.mouse.move(
            size.width / 2 + Math.cos(angle) * 200,
            size.height / 2 + Math.sin(angle) * 200,
          );
          await page.keyboard.down("Space");
          await page.waitForTimeout(1000);
          await page.keyboard.up("Space");
        }
        combat = await readSaved();
      }
      if (combat.chapter !== chapter + 1 || combat.mode !== "space")
        throw new Error(
          `Campaign boss ${chapter} failed: hull ${combat.ship.hull}, mode ${combat.mode}`,
        );
      console.log(
        `${name}: chapter ${chapter + 1}/5 passed with earned equipment`,
      );
      if (chapter === 2) {
        await page.reload({ waitUntil: "networkidle" });
        await page.locator('[data-action="continue"]').click();
      }
    }
    await page.locator('.quick-nav [data-param="quests"]').click();
    await page
      .locator('[data-action="ending"][data-param="colonists"]')
      .click();
    await page.screenshot({ path: `test-results/${name}-ending.png` });
    await page.locator('.menu-footer [data-action="close"]').click();
    const finalState = await readSaved();
    if (finalState.ending !== "colonists" || finalState.bosses.length !== 5)
      throw new Error("Ending was not saved");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-action="continue"]').click();
    if (
      !(await page.locator("#system-name").innerText()).includes(
        "СВОБОДНЫЙ ПОЛЁТ",
      )
    )
      throw new Error("Free play unavailable after ending reload");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      `${name}: PASS New Game → delivery/passengers → save/reload → earned upgrades → five real bosses → saved ending → free play`,
    );
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    await page.screenshot({ path: `test-results/${name}-failure.png` });
    console.error(failures.at(-1));
  } finally {
    await browser.close();
  }
}
if (failures.length) process.exitCode = 1;
