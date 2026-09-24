import path from "node:path";
import type { EgreterProject } from "@egreter/project";
import type { InlineConfig } from "vite";

export interface WebTargetOverrides {
  host?: string | boolean;
  port?: number;
  open?: boolean;
}

export function createWebViteConfig(
  project: EgreterProject,
  overrides: WebTargetOverrides = {}
): InlineConfig {
  const { config, root } = project;
  const publicDir =
    config.assets === false ? false : path.resolve(root, config.assets);

  return {
    root,
    configFile: false,
    publicDir,
    clearScreen: false,
    appType: "spa",
    server: {
      ...(overrides.host === undefined && config.server.host === undefined
        ? {}
        : { host: overrides.host ?? config.server.host }),
      port: overrides.port ?? config.server.port,
      open: overrides.open ?? config.server.open,
      strictPort: true
    },
    build: {
      outDir: path.resolve(root, config.outDir),
      emptyOutDir: true,
      sourcemap: config.build.sourcemap,
      minify: config.build.minify,
      target: "es2022"
    }
  };
}
