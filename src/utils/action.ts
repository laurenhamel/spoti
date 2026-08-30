/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ActionHandler, type ActionParameters } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { Library } from "./library";
import { type Command } from "commander";
import { merge } from "lodash-es";
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
    const next: ActionParameters<TArgs, TOptions> = [...args, options, command];
    await Library.mount(process.env.PWD!, options);
    return callback(...next);
  };
}

export function mergeOptions<TOptions extends SpotiOptions>(
  defaults?: Partial<TOptions>,
  overrides?: Partial<TOptions>
): TOptions {
  return merge({}, defaults, overrides) as TOptions;
}
