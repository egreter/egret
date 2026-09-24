import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { EgreterError } from "@egreter/diagnostics";

export interface CreateProjectOptions {
  directory: string;
  template?: "basic";
  install?: boolean;
  force?: boolean;
  packageManager?: "pnpm" | "npm";
  cwd?: string;
}

const PACKAGE_VERSION = "0.1.0";
const TEMPLATE_ROOT = fileURLToPath(new URL("../templates", import.meta.url));

async function isDirectoryEmpty(directory: string): Promise<boolean> {
  try {
    return (await readdir(directory)).length === 0;
  } catch {
    return true;
  }
}

function normalizePackageName(directory: string): string {
  const raw = path.basename(directory).toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  return normalized || "egreter-game";
}

function detectPackageManager(): "pnpm" | "npm" {
  const userAgent = process.env.npm_config_user_agent ?? "";
  return userAgent.startsWith("npm/") ? "npm" : "pnpm";
}

async function replaceTokens(directory: string, tokens: Record<string, string>): Promise<void> {
  const entries = await readdir(directory);
  for (const entry of entries) {
    const file = path.join(directory, entry);
    const info = await stat(file);
    if (info.isDirectory()) {
      await replaceTokens(file, tokens);
      continue;
    }

    if (!/\.(json|ts|html|md|gitignore)$/i.test(entry) && entry !== ".gitignore") {
      continue;
    }

    let content = await readFile(file, "utf8");
    for (const [token, value] of Object.entries(tokens)) {
      content = content.split(token).join(value);
    }
    await writeFile(file, content);
  }
}

async function installDependencies(directory: string, packageManager: "pnpm" | "npm"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(packageManager, ["install"], {
      cwd: directory,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new EgreterError("E_INSTALL_FAILED", `${packageManager} install exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

export async function createProject(options: CreateProjectOptions): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const target = path.resolve(cwd, options.directory);
  const template = options.template ?? "basic";

  if (template !== "basic") {
    throw new EgreterError("E_TEMPLATE_UNKNOWN", `Unknown Egreter template: ${template}`);
  }

  if (!(await isDirectoryEmpty(target)) && !options.force) {
    throw new EgreterError(
      "E_CREATE_NOT_EMPTY",
      "Target directory is not empty. Use --force only when you intend to overwrite template files.",
      target
    );
  }

  await mkdir(target, { recursive: true });
  await cp(path.join(TEMPLATE_ROOT, template), target, {
    recursive: true,
    force: options.force ?? false
  });

  const packageSpec = process.env.EGRETER_PACKAGE_SPEC ?? `^${PACKAGE_VERSION}`;
  await replaceTokens(target, {
    "__PROJECT_NAME__": normalizePackageName(target),
    "__EGRETER_PACKAGE_SPEC__": packageSpec
  });

  if (options.install !== false) {
    await installDependencies(target, options.packageManager ?? detectPackageManager());
  }

  return target;
}
