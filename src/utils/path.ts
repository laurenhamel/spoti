import { runSync } from "./process";
import { compact, isEmpty } from "lodash-es";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "../../");
const HOME = homedir();
const CWD = process.cwd();

/**
 * Resolves paths relative to the root of this project
 */
export function resolveRoot(...paths: string[]): string {
  return resolve(ROOT, ...paths);
}

/**
 * Resolves paths relative to the directory where the CLI is running from
 */
export function resolveCwd(...paths: string[]): string {
  return resolve(CWD, ...paths);
}

/**
 * Resolves paths relative to the current user's home directory
 */
export function resolveHome(...paths: string[]): string {
  return resolve(HOME, ...paths);
}

export function resolveModules(): string[] {
  const local = resolveRoot("node_modules/");
  const global = runSync("npm root --global");
  return compact([local, isEmpty(global) ? null : global]);
}

export function resolveBin(
  name: string,
  node: boolean = true
): string | undefined {
  if (node) {
    return resolveModules().find((modules) => {
      const bin = resolve(modules, "bin/", name);
      return existsSync(bin);
    });
  }

  const bin = runSync(`which ${name}`);
  return isEmpty(bin) ? undefined : bin;
}
