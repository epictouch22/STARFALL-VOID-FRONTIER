import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, webkit, devices } from "@playwright/test";
const base =
  process.env.GAME_URL ||
  "https://epictouch22.github.io/STARFALL-VOID-FRONTIER/";
const local = await readFile("dist/index.html", "utf8");
const assetPaths = (text) =>
  [...text.matchAll(/(?:src|href)="([^"]+\/assets\/[^\"]+)"/g)]
    .map((m) => m[1])
    .sort();
const response = await fetch(`${base}?check=${Date.now()}`, {
  cache: "no-store",
});
if (!response.ok) throw new Error(`Published HTML: ${response.status}`);
const remote = await response.text(),
  paths = assetPaths(local);
if (
  !paths.length ||
  JSON.stringify(paths) !== JSON.stringify(assetPaths(remote))
)
  throw new Error("Published assets do not match this production build yet");
for (const path of paths) {
  if (!path.startsWith("/STARFALL-VOID-FRONTIER/assets/"))
    throw new Error(`Invalid Pages base: ${path}`);
  const result = await fetch(new URL(path, base));
  if (!result.ok) throw new Error(`Asset ${result.status}: ${path}`);
  const bytes = Buffer.from(await result.arrayBuffer());
  const expected = await readFile(
    `dist/${path.split("/STARFALL-VOID-FRONTIER/")[1]}`,
  );
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  if (digest(bytes) !== digest(expected))
    throw new Error(`Published asset contents differ: ${path}`);
  console.log(`Published asset matches local build: ${path}`);
}
for (const [name, type, options] of [
  ["Chromium", chromium, { viewport: { width: 1440, height: 1000 } }],
  ["iPhone WebKit", webkit, { ...devices["iPhone 13"] }],
]) {
  const browser = await type.launch({ headless: true });
  try {
    const page = await browser.newPage(options),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator('[data-action="new"]').click();
    await page.locator('.header-actions [data-action="panel"]').click();
    for (const panel of [
      "inventory",
      "medical",
      "character",
      "ship",
      "galaxy",
      "quests",
      "tech",
      "craft",
      "trade",
      "codex",
      "settings",
      "help",
    ]) {
      await page.locator(`.menu-tabs [data-param="${panel}"]`).click();
      if (!(await page.locator(".menu-content").innerText()).trim())
        throw new Error(`Empty panel: ${panel}`);
      if (await page.locator('[data-action="debug"]').count())
        throw new Error("Debug UI exposed in production");
    }
    await page.locator('.menu-footer [data-action="close"]').click();
    await page.locator('.header-actions [data-action="save"]').click();
    const state = await page.evaluate(() =>
      JSON.parse(
        JSON.parse(localStorage.getItem("starfall-save-v1-0")).payload,
      ),
    );
    if (state.version !== 4 || state.intro !== 0)
      throw new Error("Published New Game/save version mismatch");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      `${name}: published New Game, all 12 panels and browser save PASS`,
    );
  } finally {
    await browser.close();
  }
}
