export type EgreterMode = "development" | "production";

export interface EgreterStageConfig {
  width?: number;
  height?: number;
  frameRate?: number;
  background?: string;
}

export interface EgreterServerConfig {
  host?: string | boolean;
  port?: number;
  open?: boolean;
}

export interface EgreterBuildConfig {
  sourcemap?: boolean;
  minify?: boolean;
}

export type EgreterWebBootstrapPhase =
  | "before-scripts"
  | "before-entry"
  | "after-entry";

export interface EgreterWebBootstrapConfig {
  file: string;
  phase?: EgreterWebBootstrapPhase;
}

export interface EgreterWebScriptConfig {
  src: string;
  id?: string;
  inject?: "head" | "body";
  type?: "classic" | "module";
  async?: boolean;
  defer?: boolean;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  integrity?: string;
  referrerPolicy?: string;
  attributes?: Record<string, string>;
}

export type EgreterWebScript = string | EgreterWebScriptConfig;
export type EgreterWebBootstrap = string | EgreterWebBootstrapConfig;

export interface EgreterWebTargetConfig {
  /**
   * undefined: use ./index.html when present, otherwise generate a default host page.
   * string: use the specified host page.
   * false: always generate the default host page.
   */
  html?: string | false;
  scripts?: EgreterWebScript[];
  bootstrap?: EgreterWebBootstrap[];
}

export interface EgreterTargetsConfig {
  web?: EgreterWebTargetConfig;
}

export interface EgreterConfig {
  entry?: string;
  assets?: string | false;
  outDir?: string;
  target?: "web";
  targets?: EgreterTargetsConfig;
  stage?: EgreterStageConfig;
  server?: EgreterServerConfig;
  build?: EgreterBuildConfig;
}

export interface ResolvedEgreterWebScriptConfig
  extends Omit<EgreterWebScriptConfig, "inject" | "type"> {
  inject: "head" | "body";
  type: "classic" | "module";
}

export interface ResolvedEgreterWebBootstrapConfig {
  file: string;
  phase: EgreterWebBootstrapPhase;
}

export interface ResolvedEgreterWebTargetConfig {
  html?: string | false;
  scripts: ResolvedEgreterWebScriptConfig[];
  bootstrap: ResolvedEgreterWebBootstrapConfig[];
}

export interface ResolvedEgreterConfig {
  entry: string;
  assets: string | false;
  outDir: string;
  target: "web";
  targets: {
    web: ResolvedEgreterWebTargetConfig;
  };
  stage: Required<EgreterStageConfig>;
  server: Required<Pick<EgreterServerConfig, "port" | "open">> & Pick<EgreterServerConfig, "host">;
  build: Required<EgreterBuildConfig>;
}

function resolveWebTarget(config: EgreterWebTargetConfig = {}): ResolvedEgreterWebTargetConfig {
  const resolved: ResolvedEgreterWebTargetConfig = {
    scripts: (config.scripts ?? []).map((script) => {
      const value = typeof script === "string" ? { src: script } : script;
      return {
        ...value,
        inject: value.inject ?? "head",
        type: value.type ?? "classic"
      };
    }),
    bootstrap: (config.bootstrap ?? []).map((bootstrap) => {
      const value = typeof bootstrap === "string" ? { file: bootstrap } : bootstrap;
      return {
        file: value.file,
        phase: value.phase ?? "before-entry"
      };
    })
  };

  if (config.html !== undefined) {
    resolved.html = config.html;
  }

  return resolved;
}

export function defineConfig(config: EgreterConfig): EgreterConfig {
  return config;
}

export function resolveConfig(config: EgreterConfig = {}): ResolvedEgreterConfig {
  return {
    entry: config.entry ?? "src/main.ts",
    assets: config.assets ?? "assets",
    outDir: config.outDir ?? "dist",
    target: config.target ?? "web",
    targets: {
      web: resolveWebTarget(config.targets?.web)
    },
    stage: {
      width: config.stage?.width ?? 750,
      height: config.stage?.height ?? 1334,
      frameRate: config.stage?.frameRate ?? 60,
      background: config.stage?.background ?? "#111827"
    },
    server: {
      ...(config.server?.host === undefined ? {} : { host: config.server.host }),
      port: config.server?.port ?? 5173,
      open: config.server?.open ?? false
    },
    build: {
      sourcemap: config.build?.sourcemap ?? true,
      minify: config.build?.minify ?? true
    }
  };
}
