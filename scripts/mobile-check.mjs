import { webkit, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base =
  process.env.GAME_URL || "http://localhost:4173/STARFALL-VOID-FRONTIER/";
await mkdir("test-results", { recursive: true });
const browser = await webkit.launch({ headless: true });
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 664 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ ...devices["iPhone 13"], viewport }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator('[data-action="new"]').click();
    for (const setting of ["Home", "End"]) {
      await page.locator('.header-actions [data-action="panel"]').click();
      await page.locator('.menu-tabs [data-param="settings"]').click();
      for (const key of ["uiScale", "stickSize", "opacity", "sensitivity"]) {
        const range = page.locator(`input[data-setting="${key}"]`);
        await range.focus();
        await range.press(setting);
      }
      await page.locator('.menu-footer [data-action="close"]').click();
      await page.waitForTimeout(250);
      const controls = await page
        .locator(
          "#stick-left,#stick-right,#interact-button,.header-actions button",
        )
        .evaluateAll((nodes) =>
          nodes.map((n) => {
            const r = n.getBoundingClientRect();
            return {
              id: n.id || n.dataset.action,
              width: r.width,
              height: r.height,
              x: r.x,
              y: r.y,
            };
          }),
        );
      for (const c of controls)
        if (
          c.width < 44 ||
          c.height < 44 ||
          c.x < 0 ||
          c.x + c.width > viewport.width + 1 ||
          c.y < 0 ||
          c.y + c.height > viewport.height + 1
        )
          throw Error(
            `Unusable control ${viewport.width} ${setting}: ${JSON.stringify(c)}`,
          );
      const a = await page.locator("#telemetry").boundingBox(),
        b = await page.locator("#objective").boundingBox();
      if (
        a.x + a.width > b.x &&
        b.x + b.width > a.x &&
        a.y + a.height > b.y &&
        b.y + b.height > a.y
      )
        throw Error(`Overlapping HUD ${viewport.width} ${setting}`);
      await page.screenshot({
        path: `test-results/mobile-${viewport.width}-${setting}.png`,
      });
    }
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      `WebKit ${viewport.width}×${viewport.height}: minimum/maximum settings, 44px controls, non-overlapping HUD PASS`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
