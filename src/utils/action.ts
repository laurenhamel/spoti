/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ActionHandler, type ActionParameters } from "../types/action";
import {
  type SpotiConfigurationLayer,
  type SpotiOptions,
} from "../types/configuration";
import { detectConfigurations, loadConfigurations } from "./configuration";
import { Library } from "./library";
import { type Command } from "commander";
import { omit } from "lodash-es";
import yargs from "yargs";

function cleanGlobals(args: any[], argv: any): any[] {
  for (const key in argv) {
    if (!["$0", "_"].includes(key)) {
      const index = args.indexOf(`--${key}`);

      if (index > -1) {
        args[index] = undefined;
      }
    }
  }

  return args;
}

export function createAction<
  TArgs extends any[],
  TOptions extends SpotiOptions,
>(callback: ActionHandler<TArgs, TOptions>): Parameters<Command["action"]>[0] {
  return async (...params: Parameters<Parameters<Command["action"]>[0]>) => {
    const command = params.slice(-1)[0] as Command;
    const argv = yargs(command.args).argv as any;
    const args = cleanGlobals(params.slice(0, -2), argv) as TArgs;
    const options = { ...argv, ...command.optsWithGlobals() } as TOptions;
    const next: ActionParameters<TArgs, TOptions> = [...args, options];
    await Library.mount(process.env.PWD!, options);
    return callback(...next);
  };
}

export function detectOptions<TOptions extends SpotiOptions>(
  defaults?: Partial<TOptions>,
  overrides?: Partial<TOptions>
): SpotiConfigurationLayer<TOptions>[] {
  return detectConfigurations<TOptions>(defaults, overrides);
}

export async function mergeOptions<TOptions extends SpotiOptions>(
  defaults?: Partial<TOptions>,
  overrides?: Partial<TOptions>
): Promise<TOptions> {
  return loadConfigurations<TOptions>(defaults, overrides);
}

export function pruneOptions<TOptions extends SpotiOptions>(
  options: TOptions
): TOptions {
  const prune = ["_", "$0"] as (keyof TOptions)[];
  return omit(options, ...prune) as TOptions;
}
