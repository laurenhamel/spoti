import {
  type ProcessExitRegistrar,
  type ProcessExitConfig,
  type ProcessExitRegister,
} from "../types/process";

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
