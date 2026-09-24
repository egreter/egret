#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const testRoot = path.join(root, ".egreter-test");
const projectRoot = path.join(testRoot, "basic");
const cli = path.join(root, "packages", "cli", "dist", "bin.js");
const keep = process.argv.includes("--keep");
const skipDev = process.argv.includes("--skip-dev");
const startedAt = new Date().toISOString();

const report = {
  startedAt,
  finishedAt: null,
  ok: false,
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  pnpm: null,
  steps: []
};

function executable(command) {
  return process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
}

async function run(command, args, options = {}) {
  const step = {
    command: [command, ...args].join(" "),
    cwd: options.cwd ?? root,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    code: null
  };
  report.steps.push(step);

  return await new Promise((resolve, reject) => {
    const child = spawn(executable(command), args, {
      cwd: step.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false
    });

    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.once("error", reject);
    child.once("exit", (code) => {
      step.finishedAt = new Date().toISOString();
      step.code = code;
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `Command failed (${code ?? "unknown"}): ${step.command}\n${stdout}\n${stderr}`
          )
        );
      }
    });
  });
}

async function assertFile(file) {
  await access(file);
}

async function findJavaScriptFiles(directory) {
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findJavaScriptFiles(fullPath)));
    } else if (entry.name.endsWith(".js")) {
      found.push(fullPath);
    }
  }
  return found;
}

async function waitForDevServer(child, logs, url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${child.exitCode}.\n${logs()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for dev server at ${url}.\n${logs()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function verifyDevServer() {
  const port = 5199;
  const child = spawn(
    process.execPath,
    [cli, "dev", ".", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    }
  );

  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    const htmlResponse = await waitForDevServer(child, () => output, `http://127.0.0.1:${port}/`);
    const html = await htmlResponse.text();
    if (!html.includes('id="game"')) {
      throw new Error("Dev server HTML does not contain the Egreter canvas.");
    }

    const assetResponse = await fetch(`http://127.0.0.1:${port}/egreter.svg`);
    if (!assetResponse.ok) {
      throw new Error(`Dev server asset request failed: ${assetResponse.status}`);
    }
  } finally {
    await stopChild(child);
  }
}

async function writeReport() {
  report.finishedAt = new Date().toISOString();
  await mkdir(testRoot, { recursive: true });
  await writeFile(path.join(testRoot, "report.json"), JSON.stringify(report, null, 2) + "\n");
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 24) {
    throw new Error(`Node.js 24+ is required. Current: ${process.version}`);
  }

  await rm(projectRoot, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });

  const pnpmVersion = await run("pnpm", ["--version"], { capture: true });
  report.pnpm = pnpmVersion.stdout.trim();
  const pnpmMajor = Number(report.pnpm.split(".")[0]);
  if (!Number.isInteger(pnpmMajor) || pnpmMajor < 12) {
    throw new Error(`pnpm 12+ is required. Current: ${report.pnpm}`);
  }

  await run("pnpm", ["build"]);

  const version = await run(process.execPath, [cli, "--version"], { capture: true });
  if (!version.stdout.trim().startsWith("0.1.0")) {
    throw new Error(`Unexpected CLI version: ${version.stdout.trim()}`);
  }

  await run(
    process.execPath,
    [cli, "create", projectRoot, "--template", "basic", "--no-install"],
    {
      env: {
        EGRETER_PACKAGE_SPEC: "workspace:*"
      }
    }
  );

  for (const relative of [
    "package.json",
    "egreter.config.ts",
    "tsconfig.json",
    "index.html",
    "src/main.ts",
    "assets/egreter.svg"
  ]) {
    await assertFile(path.join(projectRoot, relative));
  }

  const generatedPackage = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
  if (generatedPackage.dependencies?.["@egreter/engine"] !== "workspace:*") {
    throw new Error("Generated project did not use the internal workspace package spec.");
  }

  await run("pnpm", ["install", "--lockfile=false"], { cwd: projectRoot });
  await run(process.execPath, [cli, "doctor", "."], { cwd: projectRoot });
  await run(process.execPath, [cli, "build", "."], { cwd: projectRoot });

  await assertFile(path.join(projectRoot, "dist", "index.html"));
  await assertFile(path.join(projectRoot, "dist", "egreter.svg"));
  const builtJavaScript = await findJavaScriptFiles(path.join(projectRoot, "dist"));
  if (builtJavaScript.length === 0) {
    throw new Error("Build completed without emitting JavaScript.");
  }
  await assertFile(`${builtJavaScript[0]}.map`);

  if (!skipDev) {
    await verifyDevServer();
  }

  report.ok = true;
}

try {
  await main();
  console.log("\nEgreter CLI verification passed.");
  console.log(`Report: ${path.join(testRoot, "report.json")}`);
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("\nEgreter CLI verification failed.");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await writeReport();
  if (!keep && report.ok) {
    await rm(projectRoot, { recursive: true, force: true });
  }
}
