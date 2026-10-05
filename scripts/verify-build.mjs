import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
const base = "/STARFALL-VOID-FRONTIER/";
const html = await readFile("dist/index.html", "utf8");
const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
if (urls.length < 2) throw new Error("Production HTML lacks bundle assets");
for (const url of urls) {
  if (!url.startsWith(base)) throw new Error(`Wrong Pages base: ${url}`);
  await access(join("dist", url.slice(base.length)));
}
console.log(`GitHub Pages build verified: ${urls.length} assets under ${base}`);
