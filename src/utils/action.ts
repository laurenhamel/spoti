import { type Command } from "commander";
import yargs from "yargs";
import { type SpotiOptions } from "../types";
import { Library } from "./library";

export type ActionParameters<TArgs extends any[], TOptions extends object> = [
  ...TArgs,
  TOptions,
  Command
];

export type ActionHandler<TArgs extends any[], TOptions extends object> = (
  ...params: ActionParameters<TArgs, TOptions>
) => void | Promise<void>;

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

export function createActionHandler<
  TArgs extends any[],
  TOptions extends SpotiOptions
>(callback: ActionHandler<TArgs, TOptions>): Parameters<Command["action"]>[0] {
  return async (...params: Parameters<Parameters<Command["action"]>[0]>) => {
    const command = params.slice(-1)[0] as Command;
    const argv = yargs(command.args).argv as any;
    const args = cleanGlobals(params.slice(0, -2), argv) as TArgs;
    const options = { ...argv, ...command.optsWithGlobals() } as TOptions;
    const next: ActionParameters<TArgs, TOptions> = [...args, options, command];
    process.env.PWD = options.pwd ?? process.env.PWD ?? process.cwd();
    await Library.mount(process.env.PWD, options);
    return callback(...next);
  };
}
