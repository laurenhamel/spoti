import { type SpotiConfiguration } from "../types/configuration";
import { isDebuggingEnabled } from "./console";
import { locateUser } from "./path";
import dotenv from "dotenv";
import { camelCase, set } from "lodash-es";

const ENV_PREFIX = "SPOTI_";

/**
 * Locates `.env` files in supported locations
 */
export function locateEnvs(): string[] {
  return locateUser(".env");
}

/**
 * Loads `.env` files from supported locations
 */
export function loadEnvs(): void {
  const path = locateEnvs();
  dotenv.config({ path, quiet: true });
}

/**
 * Convert environment variables to a configuration
 */
export function convertEnvs<
  TConfiguration extends SpotiConfiguration,
>(): TConfiguration {
  const result = {} as TConfiguration;

  result.debug = isDebuggingEnabled();

  for (const variable in process.env) {
    if (variable.startsWith(ENV_PREFIX)) {
      const constant = variable.substring(ENV_PREFIX.length);
      const key = constant.split("_").map(camelCase);
      const value = process.env[variable];
      set(result, key, value);
    }
  }

  return result;
}
