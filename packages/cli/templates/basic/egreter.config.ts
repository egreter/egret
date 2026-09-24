import { defineConfig } from "@egreter/config";

export default defineConfig({
  entry: "src/main.ts",
  assets: "assets",
  outDir: "dist",
  target: "web",
  targets: {
    web: {
      html: "./index.html"
    }
  },
  stage: {
    width: 750,
    height: 1334,
    frameRate: 60,
    background: "#111827"
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    sourcemap: true,
    minify: true
  }
});
