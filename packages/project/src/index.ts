import { access } from "node:fs/promises";
import path from "node:path";
import {
  resolveConfig,
  type EgreterConfig,
  type ResolvedEgreterConfig
} from "@egreter/config";
import { EgreterError } from "@egreter/diagnostics";
import { loadConfigFromFile, type ConfigEnv } from "vite";

const CONFIG_FILES = [
  "egreter.config.ts",
  "egreter.config.mts",
  "egreter.config.js",
  "egreter.config.mjs"
] as const;

export interface EgreterProject {
  root: string;
  configFile: string;
  config: ResolvedEgreterConfig;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function findProjectRoot(input = process.cwd()): Promise<string> {
  let current = path.resolve(input);

  if (!(await exists(current))) {
    throw new EgreterError("E_PROJECT_NOT_FOUND", `Project path does not exist: ${current}`, current);
  }

  while (true) {
    for (const name of CONFIG_FILES) {
      if (await exists(path.join(current, name))) {
        return current;
      }
    }

    if (await exists(path.join(current, "egretProperties.json"))) {
      throw new EgreterError(
        "E_LEGACY_PROJECT_UNSUPPORTED",
        "Legacy Egret projects are not supported. Create a modern project with 'egreter create'.",
        current
      );
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new EgreterError(
    "E_PROJECT_CONFIG_NOT_FOUND",
    "No egreter.config.ts (or .mts/.js/.mjs) was found.",
    path.resolve(input)
  );
}

export async function loadProject(
  input = process.cwd(),
  command: ConfigEnv["command"] = "serve",
  mode = command === "build" ? "production" : "development"
): Promise<EgreterProject> {
  const root = await findProjectRoot(input);

  let selectedConfigFile: string | undefined;
  for (const name of CONFIG_FILES) {
    const candidate = path.join(root, name);
    if (await exists(candidate)) {
      selectedConfigFile = candidate;
      break;
    }
  }

  if (!selectedConfigFile) {
    throw new EgreterError("E_PROJECT_CONFIG_NOT_FOUND", "Egreter config file is missing.", root);
  }

  const loaded = await loadConfigFromFile({ command, mode }, selectedConfigFile, root);
  if (!loaded) {
    throw new EgreterError("E_PROJECT_CONFIG_INVALID", "Unable to load Egreter config.", selectedConfigFile);
  }

  return {
    root,
    configFile: selectedConfigFile,
    config: resolveConfig(loaded.config as EgreterConfig)
  };
}
