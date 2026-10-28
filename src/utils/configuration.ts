import { invokePlugins } from "../plugins";
import {
  SpotiConfigurationSource,
  type SpotiConfigurationLayer,
  type SpotiConfiguration,
} from "../types/configuration";
import { convertEnvs } from "./environment";
import { locateUser, locateRoot, resolveRoot } from "./path";
import JSONC from "jsonc-simple-parser";
import { compact, get, merge } from "lodash-es";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let Configuration: SpotiConfiguration;

/**
 * Supported project-local default configuration files.
 */
const CONFIGURATION_DEFAULTS = [
  ".spotirc.default.json",
  ".spotirc.default.jsonc",
  ".spotirc.local.json",
  ".spotirc.local.jsonc",
];

/**
 * Supported project-local user configuration files.
 */
const CONFIGURATION_USER = [".spotirc.user.json", ".spotirc.user.jsonc"];

/**
 * Supported configuration file names, in order of preference.
 */
const CONFIGURATION_FILES = [
  ".spotirc",
  ".spotirc.json",
  ".spotirc.jsonc",
  ...CONFIGURATION_USER,
];

/**
 * Locates default configuration files in the project root
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
function locateDefaultConfigurations(): string[] {
  return compact(CONFIGURATION_DEFAULTS.flatMap(locateRoot));
}

/**
 * Locates user configuration files in supported locations
 *
 * @remarks
 * Searches the project root directory, user home directory, and
 * directory where the CLI is running from, in that order.
 */
function locateUserConfigurations(): string[] {
  return compact(CONFIGURATION_FILES.flatMap(locateUser));
}

/**
 * Reads the configuration file
 */
function readConfiguration<TConfiguration extends SpotiConfiguration>(
  file?: string,
  fallback: TConfiguration = {} as TConfiguration
): TConfiguration {
  if (file && existsSync(file)) {
    const json = readFileSync(file, "utf8");
    return JSONC.parse(json) as TConfiguration;
  }

  return fallback;
}

/**
 * Reads the user configuration to a project-local user configuration file.
 */
export function readUserConfiguration<
  TConfiguration extends SpotiConfiguration,
>(): TConfiguration {
  const paths = CONFIGURATION_USER.map((file) => resolveRoot(file));
  const src = paths.find((path) => existsSync(path));
  return readConfiguration<TConfiguration>(src);
}

/**
 * Saves the user configuration to a project-local user configuration file.
 */
export function saveUserConfiguration<
  TConfiguration extends SpotiConfiguration,
>(config: TConfiguration = {} as TConfiguration): void {
  const json = JSON.stringify(config, null, 2);
  const paths = CONFIGURATION_USER.map((file) => resolveRoot(file));
  const dest = paths.find((path) => existsSync(path)) ?? paths[0];
  writeFileSync(dest, json);
}

/**
 * Updates the user configuration in the project-local user configuration file.
 */
export function updateUserConfiguration<
  TConfiguration extends SpotiConfiguration,
>(patch: Partial<TConfiguration>): void {
  const previous = readUserConfiguration<TConfiguration>();
  const next = merge({}, previous, patch);
  saveUserConfiguration(next);
}

/**
 * Reduces a list of configuration files paths to a single configuration
 * object, where latter configurations will overwrite former configurations.
 */
function reduceConfigurations<TConfiguration extends SpotiConfiguration>(
  ...files: string[]
): TConfiguration {
  return files.reduce((previous, file) => {
    const next = readConfiguration(file);
    return merge(previous, next);
  }, {} as TConfiguration);
}

/**
 * Loads and merges all configurations together.
 *
 * @remarks
 * Loads and merges configurations in order where latter configurations
 * will overwrite former configurations: (1) project-level defaults, (2)
 * command-level defaults, (3) environment variable overrides, (4) user
 * configuration files, and (5) CLI options (i.e., when running from a CLI
 * context). User configuration files are resolved in order of preferred
 * configuration file names in path resolution order: (1) project-root
 * directory, (2) user home directory, and finally (3) CLI working directory
 * (i.e., the directory that the Spoti CLI is running in/from, usually
 * your music library folder).
 */
export async function loadConfigurations<
  TConfiguration extends SpotiConfiguration,
>(
  initial: Partial<TConfiguration> = {},
  options: Partial<TConfiguration> = {}
): Promise<TConfiguration> {
  Configuration = detectConfigurations<TConfiguration>(initial, options).reduce(
    (result, { data }) => merge(result, data),
    {} as TConfiguration
  );

  await invokePlugins("resolvedConfiguration", [Configuration]);

  return Configuration as TConfiguration;
}

/**
 * Detects and reports configuration layers in order of preference.
 */
export function detectConfigurations<TConfiguration extends SpotiConfiguration>(
  initial: Partial<TConfiguration> = {},
  options: Partial<TConfiguration> = {}
): SpotiConfigurationLayer<TConfiguration>[] {
  const defaults = locateDefaultConfigurations();
  const overrides = locateUserConfigurations();

  return [
    {
      source: SpotiConfigurationSource.DEFAULTS,
      data: reduceConfigurations<TConfiguration>(...defaults),
    },
    {
      source: SpotiConfigurationSource.CLI_DEFAULTS,
      data: initial as TConfiguration,
    },
    {
      source: SpotiConfigurationSource.ENV,
      data: convertEnvs<TConfiguration>(),
    },
    {
      source: SpotiConfigurationSource.USER,
      data: reduceConfigurations<TConfiguration>(...overrides),
    },
    {
      source: SpotiConfigurationSource.CLI_OPTIONS,
      data: options as TConfiguration,
    },
  ];
}

/**
 * Get the currently loaded configuration.
 */
export function getConfiguration<
  TConfiguration extends SpotiConfiguration,
>(): TConfiguration {
  return Configuration as TConfiguration;
}

/**
 * Get a given key from the currently loaded configuration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getConfigurationKey(key: string | string[]): any {
  return get(Configuration, key);
}
