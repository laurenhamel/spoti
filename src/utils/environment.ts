import { type SpotiConfiguration } from "../types/configuration";
import { isDebuggingEnabled } from "./console";
import { locateUser } from "./path";
import dotenv from "dotenv";
import { camelCase, isEmpty, set } from "lodash-es";

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

/**
 * Ensure the given environment variable is set or uses the fallback given
 * @param variable - The environment variable key to lookup
 * @param fallback - A fallback value to use for the environment variable
 */
export function ensureEnvVar<TValue extends boolean | number | string>(variable: string, fallback: TValue): TValue {
  let value: TValue | undefined = variable in process.env ? process.env[variable] as TValue : undefined;
  value = !value || isEmpty(value) ? fallback : value;
  process.env[variable] = `${value}`;
  return value;
}
