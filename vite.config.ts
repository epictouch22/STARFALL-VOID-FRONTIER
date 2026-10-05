import { defineConfig } from "vite";
export default defineConfig({
  base: "/STARFALL-VOID-FRONTIER/",
  build: { target: "safari15", sourcemap: false },
  server: { host: true },
});
