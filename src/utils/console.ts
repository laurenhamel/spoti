import { type SpotiOptions } from "../types/config";
import chalk from "chalk";

export function silenceWarnings(): () => void {
  const initial = console.warn;
  console.warn = () => {};
  return () => (console.warn = initial);
}

export function reportDry<TOptions extends SpotiOptions & { dry?: boolean }>(
  options?: TOptions
): void {
  if (options?.dry) {
    console.log();
    console.log(chalk.blue("This was a dry run. No changes have been saved!"));
  }
}
