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

export interface EgreterConfig {
  entry?: string;
  assets?: string | false;
  outDir?: string;
  target?: "web";
  stage?: EgreterStageConfig;
  server?: EgreterServerConfig;
  build?: EgreterBuildConfig;
}

export interface ResolvedEgreterConfig {
  entry: string;
  assets: string | false;
  outDir: string;
  target: "web";
  stage: Required<EgreterStageConfig>;
  server: Required<Pick<EgreterServerConfig, "port" | "open">> & Pick<EgreterServerConfig, "host">;
  build: Required<EgreterBuildConfig>;
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
