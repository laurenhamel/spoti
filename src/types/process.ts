export type ProcessExitCallback = () => void;

export type ProcessExitSignal = "SIGINT" | "SIGTERM";

export type ProcessExitConfig = Partial<
  Record<ProcessExitSignal, ProcessExitCallback>
>;

export type ProcessExitRegister = () => ProcessExitConfig;

export type ProcessExitRegistrar = (...configs: ProcessExitConfig[]) => void;
