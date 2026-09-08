import {
  type ProcessExitRegistrar,
  type ProcessExitConfig,
  type ProcessExitRegister,
} from "../types/process";
import { kebabCase, merge, isNil, isString } from "lodash-es";
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { type Primitive } from "type-fest";

const DEFAULT_PROCESS_EXIT_CONFIG: ProcessExitConfig = {
  SIGINT: () => process.exit(0),
};

export const gracefullyStopProcess: ProcessExitRegister = () =>
  DEFAULT_PROCESS_EXIT_CONFIG;

export const registerProcessExitHandlers: ProcessExitRegistrar = (
  ...configs
) => {
  for (const config of configs) {
    for (const signal in config) {
      const handler = config[signal as keyof typeof config];
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      handler && process.on(signal, handler);
    }
  }
};

export function createProcessExitAbort(): AbortController {
  const controller = new AbortController();

  registerProcessExitHandlers({
    SIGINT: () => controller.abort(),
    SIGTERM: () => controller.abort(),
  });

  return controller;
}

export function convertArgs(
  options: Record<string, Primitive | Exclude<Primitive, boolean>[]>,
  delimited: boolean = false
): string[] {
  const args: string[] = [];

  const stringify = (
    flag: string,
    value: Primitive | Exclude<Primitive, boolean>[],
    delimited: boolean = false
  ): string | undefined => {
    if (isNil(value)) return;

    if (Array.isArray(value)) {
      const list: string[] = [];

      for (const input of value) {
        if (isNil(input)) continue;
        const output = stringify(flag, input, delimited)!;
        const normalized = delimited ? output.split(" ")[1] : output;
        list.push(normalized);
      }

      return delimited ? list.join(",") : list.join(" ");
    }

    if (typeof value === "boolean") {
      return value ? `--${flag}` : `--no-${flag}`;
    }

    const string = value.toString().replaceAll(/[" ]/g, "\\$1");
    return [`--${flag}`, string].join(" ");
  };

  for (const key in options) {
    const flag = kebabCase(key);
    const value = stringify(flag, options[key], delimited);
    value && args.push(...value.split(" "));
  }

  return args;
}

export function runSync(command: string, options?: SpawnSyncOptions): string {
  const [cmd, ...args] = command.split(" ");

  const { stdout, stderr, status } = spawnSync(
    cmd,
    args,
    merge(
      {
        encoding: "utf8",
        env: process.env,
      },
      options
    )
  );

  const error = isString(stderr) ? stderr.trim() : command;
  const result = isString(stdout) ? stdout.trim() : "";

  if (status !== 0) throw new Error(error);

  return result;
}
