import { existsSync, readFileSync } from "node:fs";
import Module from "node:module";
import { dirname, parse, resolve } from "node:path";

const rootEnvPath = findNearestEnvFile(process.cwd());
const workspaceRoot = dirname(rootEnvPath);

registerCompiledWorkspaceAliases(workspaceRoot);

if (existsSync(rootEnvPath)) {
  const envFile = readFileSync(rootEnvPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue);
  }
}

function findNearestEnvFile(startDir: string) {
  let currentDir = startDir;
  const root = parse(startDir).root;

  while (true) {
    const candidate = resolve(currentDir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === root) {
      return resolve(startDir, ".env");
    }

    currentDir = dirname(currentDir);
  }
}

function registerCompiledWorkspaceAliases(rootDir: string) {
  const aliases = new Map([
    ["@workmap/auth", resolve(rootDir, "apps/api/dist/packages/auth/src/index.js")],
    ["@workmap/shared-types", resolve(rootDir, "apps/api/dist/packages/shared-types/src/index.js")],
  ]);
  const moduleWithResolver = Module as unknown as {
    _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
  };
  const originalResolveFilename = moduleWithResolver._resolveFilename;

  moduleWithResolver._resolveFilename = (request, parent, isMain, options) => {
    const aliasPath = aliases.get(request);
    if (aliasPath && existsSync(aliasPath)) {
      return aliasPath;
    }

    return originalResolveFilename.call(Module, request, parent, isMain, options);
  };
}

function unquoteEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
