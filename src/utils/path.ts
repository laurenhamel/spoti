import { runSync } from "./process";
import { compact, isEmpty, uniq } from "lodash-es";
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

/**
 * Locates the given files relative to the directory where the CLI is running from
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
export function locateCwd(file: string): string | undefined {
  const path = resolveCwd(file);
  return existsSync(path) ? path : undefined;
}

/**
 * Locates the given files relative to the current user's home directory
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
export function locateHome(file: string): string | undefined {
  const path = resolveHome(file);
  return existsSync(path) ? path : undefined;
}

/**
 * Locates the given files from the root of this project
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
export function locateRoot(file: string): string | undefined {
  const path = resolveRoot(file);
  return existsSync(path) ? path : undefined;
}

/**
 * Locates the given configuration files in supported user locations
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
export function locateUser(file: string): string[] {
  const paths = uniq([resolveRoot(file), resolveHome(file), resolveCwd(file)]);
  return paths.filter(existsSync);
}

export function resolveModules(): string[] {
  const local = resolveRoot("node_modules/");
  const global = runSync("npm root --global");
  return compact([local, isEmpty(global) ? null : global]);
}

export function resolveBin(
  name: string,
  node: boolean = false
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
