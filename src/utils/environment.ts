import { resolveRoot, resolveCwd, resolveHome } from "./path";
import dotenv from "dotenv";
import { uniq } from "lodash-es";
import { existsSync } from "node:fs";

/**
 * Locates `.env` files in supported locations
 */
export function locateEnvs(): string[] {
  return locateConfigs(".env");
}

/**
 * Auto-loads `.env` files from supported locations
 */
export function loadEnvs(): void {
  const path = locateEnvs();
  dotenv.config({ path, quiet: true });
}

/**
 * Locates the given configuration files in supported locations
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
export function locateConfigs(file: string): string[] {
  const paths = uniq([resolveRoot(file), resolveHome(file), resolveCwd(file)]);
  return paths.filter(existsSync);
}
