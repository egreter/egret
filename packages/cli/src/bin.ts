#!/usr/bin/env node
import process from "node:process";
import { buildProject, cleanProject, devProject } from "@egreter/build-core";
import { formatError } from "@egreter/diagnostics";
import { loadProject } from "@egreter/project";
import { createProject } from "./project-create.js";

const VERSION = "0.1.0-dev.0";

function printHelp(): void {
  console.log(`Egreter ${VERSION}

Usage:
  egreter create <directory> [--template basic] [--no-install] [--force]
  egreter dev [project] [--host [host]] [--port <port>] [--open]
  egreter build [project]
  egreter clean [project]
  egreter doctor [project]
  egreter --version
  egreter --help

Egreter supports modern projects only. Legacy Egret projects are intentionally unsupported.
`);
}

function takeOption(args: string[], name: string): string | undefined {
  const exact = args.indexOf(name);
  if (exact >= 0) {
    const value = args[exact + 1];
    args.splice(exact, value && !value.startsWith("--") ? 2 : 1);
    return value && !value.startsWith("--") ? value : "";
  }

  const prefix = `${name}=`;
  const inline = args.findIndex((arg) => arg.startsWith(prefix));
  if (inline >= 0) {
    const value = args[inline]?.slice(prefix.length);
    args.splice(inline, 1);
    return value;
  }
  return undefined;
}

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index < 0) {
    return false;
  }
  args.splice(index, 1);
  return true;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

async function runCreate(args: string[]): Promise<void> {
  const template = takeOption(args, "--template");
  const noInstall = takeFlag(args, "--no-install");
  const force = takeFlag(args, "--force");
  const packageManager = takeOption(args, "--package-manager");
  const directory = args[0];

  if (!directory) {
    throw new Error("create requires a target directory.");
  }
  if (template && template !== "basic") {
    throw new Error("V0.1 supports only the 'basic' template.");
  }
  if (packageManager && packageManager !== "pnpm" && packageManager !== "npm") {
    throw new Error("--package-manager must be pnpm or npm.");
  }

  const target = await createProject({
    directory,
    ...(template ? { template: "basic" } : {}),
    install: !noInstall,
    force,
    ...(packageManager ? { packageManager } : {})
  });

  console.log(`Created modern Egreter project at ${target}`);
  if (noInstall) {
    console.log("Dependencies were not installed (--no-install).");
  } else {
    console.log("Next: cd into the project and run your package manager's dev script.");
  }
}

async function runDev(args: string[]): Promise<void> {
  const hostValue = takeOption(args, "--host");
  const port = parsePort(takeOption(args, "--port"));
  const open = takeFlag(args, "--open");
  const project = args[0];

  const server = await devProject({
    ...(project ? { project } : {}),
    ...(hostValue !== undefined ? { host: hostValue === "" ? true : hostValue } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(open ? { open: true } : {})
  });

  server.printUrls();
  console.log("Press Ctrl+C to stop the Egreter dev server.");

  let closing = false;
  const close = async () => {
    if (closing) {
      return;
    }
    closing = true;
    await server.close();
    process.exitCode = 0;
  };

  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

async function runBuild(args: string[]): Promise<void> {
  const project = await buildProject({ ...(args[0] ? { project: args[0] } : {}) });
  console.log(`Built ${project.root} -> ${project.config.outDir}`);
}

async function runClean(args: string[]): Promise<void> {
  const output = await cleanProject(args[0]);
  console.log(`Cleaned ${output}`);
}

async function runDoctor(args: string[]): Promise<void> {
  const major = Number(process.versions.node.split(".")[0]);
  console.log(`Node.js: ${process.version} ${major >= 24 ? "OK" : "UNSUPPORTED (requires >=24)"}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Egreter CLI: ${VERSION}`);

  if (major < 24) {
    process.exitCode = 1;
  }

  try {
    const project = await loadProject(args[0]);
    console.log(`Project: ${project.root}`);
    console.log(`Target: ${project.config.target}`);
    console.log("Project model: modern OK");
  } catch (error) {
    console.log(`Project: ${formatError(error)}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "create":
      await runCreate(args);
      break;
    case "dev":
      await runDev(args);
      break;
    case "build":
      await runBuild(args);
      break;
    case "clean":
      await runClean(args);
      break;
    case "doctor":
      await runDoctor(args);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
