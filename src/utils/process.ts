import {
  type ProcessExitRegistrar,
  type ProcessExitConfig,
  type ProcessExitRegister,
} from "../types/process";
import { merge, isString } from "lodash-es";
import { spawnSync, type SpawnSyncOptions } from "node:child_process";

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
