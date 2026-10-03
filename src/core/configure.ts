import { type ActionHandler } from "../types/action";
import {
  SpotiConfigurationSource,
  type SpotiOptions,
} from "../types/configuration";
import { detectOptions, mergeOptions, pruneOptions } from "../utils/action";
import chalk from "chalk";
import { get, isNil } from "lodash-es";

export type ConfigureArguments = [string?, string?];

export interface ConfigureOptions extends SpotiOptions {
  inspect: boolean;
}

export const CONFIGURE_DEFAULTS: ConfigureOptions = {
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
  const options = mergeOptions(CONFIGURE_DEFAULTS, config);

  const mode: "GET" | "SET" | "INSPECT" = !isNil(value)
    ? "SET"
    : options.inspect
      ? "INSPECT"
      : "GET";

  switch (mode) {
    case "INSPECT": {
      const titles: Partial<Record<SpotiConfigurationSource, string>> = {
        [SpotiConfigurationSource.DEFAULTS]: "Defaults",
        [SpotiConfigurationSource.ENV]: "Environment",
        [SpotiConfigurationSource.USER]: "User",
      };

      const layers = detectOptions(CONFIGURE_DEFAULTS, config).filter(
        // Exclude CLI configurations.
        ({ source }) =>
          ![
            SpotiConfigurationSource.CLI_DEFAULTS,
            SpotiConfigurationSource.CLI_OPTIONS,
          ].includes(source)
      );

      for (const { source, data } of layers) {
        // @TODO Validate valid user configuration key
        const suffix = !isNil(key) ? ` (${chalk.blue(key)})` : "";
        const title = titles[source] + suffix;
        const value = !isNil(key) ? get(data, key, null) : pruneOptions(data);
        console.log(title);
        console.log(JSON.stringify(value, null, 2));
      }

      break;
    }
    case "GET": {
      // @TODO Validate valid user configuration key
      const value = !isNil(key)
        ? get(options, key, null)
        : pruneOptions(options);
      console.log(JSON.stringify(value, null, 2));
      break;
    }
    case "SET": {
      // @TODO Validate valid user configuration key
      // @TODO Save user configurations locally
      break;
    }
  }
};
