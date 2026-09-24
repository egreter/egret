import path from "node:path";
import type { EgreterProject } from "@egreter/project";
import type { InlineConfig, Plugin } from "vite";

export interface WebTargetOverrides {
  host?: string | boolean;
  port?: number;
  open?: boolean;
}

function toEntryUrl(entry: string): string {
  return "/" + entry.split(path.sep).join("/").replace(/^\/+/, "");
}

function createEntryPlugin(entry: string): Plugin {
  const entryTag = `<script type="module" src="${toEntryUrl(entry)}"></script>`;

  return {
    name: "egreter:web-entry",
    transformIndexHtml(html) {
      if (html.includes("<!-- egreter:entry -->")) {
        return html.replace("<!-- egreter:entry -->", entryTag);
      }

      const moduleScript = /<script\s+type=["']module["'][^>]*src=["'][^"']+["'][^>]*><\/script>/i;
      if (moduleScript.test(html)) {
        return html.replace(moduleScript, entryTag);
      }

      return html.replace("</body>", `  ${entryTag}\n  </body>`);
    }
  };
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
    plugins: [createEntryPlugin(config.entry)],
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
