import { type Command } from "commander";
import yargs from "yargs";
import { type SpotiOptions } from "../types";

export type ActionParameters<TArgs extends any[], TOptions extends object> = [
  ...TArgs,
  TOptions,
  Command
];

export type ActionHandler<TArgs extends any[], TOptions extends object> = (
  ...params: ActionParameters<TArgs, TOptions>
) => void | Promise<void>;

export function createActionHandler<
  TArgs extends any[],
  TOptions extends SpotiOptions
>(callback: ActionHandler<TArgs, TOptions>): Parameters<Command["action"]>[0] {
  return (...params: Parameters<Parameters<Command["action"]>[0]>) => {
    const command = params.slice(-1)[0] as Command;
    const args = params.slice(0, -2) as TArgs;
    const argv = yargs(command.args).argv as any;
    const options = { ...argv, ...command.optsWithGlobals() } as TOptions;
    const next: ActionParameters<TArgs, TOptions> = [...args, options, command];
    process.env.PWD = options.pwd ?? process.env.PWD;
    return callback(...next);
  };
}
