import { type ActionHandler } from "../types/action";
import {
  SpotiConfigurationSource,
  type SpotiOptions,
} from "../types/configuration";
import { detectOptions, mergeOptions, pruneOptions } from "../utils/action";
import {
  updateUserConfiguration,
  readUserConfiguration,
  saveUserConfiguration,
} from "../utils/configuration";
import chalk from "chalk";
import { get, set, unset } from "lodash-es";

export type ConfigureArguments = [string?, string?];

export interface ConfigureOptions extends SpotiOptions {
  clean: boolean;
  inspect: boolean;
}

export const CONFIGURE_DEFAULTS: ConfigureOptions = {
  clean: false,
  inspect: false,
  verbose: false,
};

export const configure: ActionHandler<
  ConfigureArguments,
  ConfigureOptions
> = async <TOptions extends ConfigureOptions>(
  key?: string,
  value?: string,
  config?: TOptions
) => {
  const options = await mergeOptions(CONFIGURE_DEFAULTS, config);

  const mode: "CLEAN" | "GET" | "SET" | "INSPECT" = value
    ? "SET"
    : options.inspect
      ? "INSPECT"
      : options.clean
        ? "CLEAN"
        : "GET";

  switch (mode) {
    case "INSPECT": {
      const titles: Record<SpotiConfigurationSource, string> = {
        [SpotiConfigurationSource.CLI_DEFAULTS]: "CLI Defaults",
        [SpotiConfigurationSource.CLI_OPTIONS]: "CLI Options",
        [SpotiConfigurationSource.DEFAULTS]: "Defaults",
        [SpotiConfigurationSource.ENV]: "Environment",
        [SpotiConfigurationSource.USER]: "User",
      };

      const layers = detectOptions(CONFIGURE_DEFAULTS, config);

      for (const { source, data } of layers) {
        const suffix = key ? ` (${chalk.cyan(key)})` : "";
        const title = titles[source] + suffix;
        const value = key ? get(data, key) : pruneOptions(data);
        console.log(chalk.blue(title));
        console.log(JSON.stringify(value, null, 2));
        console.log();
      }

      break;
    }
    case "GET": {
      const value = key ? get(options, key) : pruneOptions(options);
      console.log(JSON.stringify(value, null, 2));
      break;
    }
    case "SET": {
      const config = set({}, key!, value);
      updateUserConfiguration(config);
      break;
    }
    case "CLEAN": {
      let config = readUserConfiguration();

      if (key) {
        unset(config, key);
      } else {
        config = {};
      }

      saveUserConfiguration(config);
      break;
    }
  }
};
