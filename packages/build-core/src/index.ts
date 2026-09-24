import { access, rm } from "node:fs/promises";
import path from "node:path";
import { EgreterError } from "@egreter/diagnostics";
import { loadProject, type EgreterProject } from "@egreter/project";
import { createWebViteConfig, type WebTargetOverrides } from "@egreter/target-web";
import { build as viteBuild, createServer, type ViteDevServer } from "vite";

async function assertFile(file: string, code: string, message: string): Promise<void> {
  try {
    await access(file);
  } catch {
    throw new EgreterError(code, message, file);
  }
}

export async function validateProject(project: EgreterProject): Promise<void> {
  await assertFile(
    path.join(project.root, "index.html"),
    "E_INDEX_NOT_FOUND",
    "Modern Egreter projects require index.html."
  );
  await assertFile(
    path.resolve(project.root, project.config.entry),
    "E_ENTRY_NOT_FOUND",
    `Egreter entry file was not found: ${project.config.entry}`
  );

  if (project.config.target !== "web") {
    throw new EgreterError(
      "E_TARGET_UNSUPPORTED",
      `Target '${project.config.target}' is not available in V0.1.`
    );
  }
}

export interface DevProjectOptions extends WebTargetOverrides {
  project?: string;
}

export async function devProject(options: DevProjectOptions = {}): Promise<ViteDevServer> {
  const project = await loadProject(options.project, "serve", "development");
  await validateProject(project);

  const server = await createServer(createWebViteConfig(project, options));
  await server.listen();
  return server;
}

export interface BuildProjectOptions {
  project?: string;
}

export async function buildProject(options: BuildProjectOptions = {}): Promise<EgreterProject> {
  const project = await loadProject(options.project, "build", "production");
  await validateProject(project);
  await viteBuild(createWebViteConfig(project));
  return project;
}

export async function cleanProject(input = process.cwd()): Promise<string> {
  const project = await loadProject(input, "build", "production");
  const output = path.resolve(project.root, project.config.outDir);
  await rm(output, { recursive: true, force: true });
  return output;
}
