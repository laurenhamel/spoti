import {
  type ProcessExitRegistrar,
  type ProcessExitConfig,
  type ProcessExitRegister,
} from "../types/process";
import { merge, isNil, isString } from "lodash-es";
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

export function convertArgs(options: Record<string, Primitive>): string[] {
  const args: string[] = [];

  for (const key in options) {
    const value = options[key];

    if (isNil(value)) continue;

    switch (typeof value) {
      case "boolean": {
        args.push(`--${key}`);
        break;
      }
      default: {
        const string = value.toString().replaceAll(/[" ]/g, "\\$1");
        args.push(`--${key}`, string);
        break;
      }
    }
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

  const error = isString(stderr) ? stderr.trim() : `Error: ${command}`;
  const result = isString(stdout) ? stdout.trim() : "";

  if (status !== 0) throw new Error(error);

  return result;
}
