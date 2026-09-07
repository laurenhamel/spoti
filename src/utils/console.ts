import { type SpotiOptions } from "../types/config";
import { type SpotifyStatus } from "../types/spotify";
import chalk from "chalk";
import { filter, pad } from "lodash-es";

const LABEL_COLORS = [
  "#6344B2",
  // "#3C57B0",
  "#1F9AEE",
  // "#0DACEF",
  "#1CBCD2",
  // "#199588",
  "#54AC58",
  // "#8FC057",
  "#CFD952",
  // "#FFE858",
  "#FFBF3B",
  // "#FD9731",
  "#FC5934",
  // "#F1463F",
  "#E62A65",
  // "#9936AC",
];

export function silenceWarnings(): () => void {
  const initial = console.warn;
  console.warn = () => {};
  return () => (console.warn = initial);
}

const chooseColor = (() => {
  let index = 0;

  return (): string => {
    if (index + 1 === LABEL_COLORS.length) index = 0;
    return LABEL_COLORS[index++];
  };
})();

export const createLabel = (() => {
  const cache: Record<string, string> = {};

  return (text: string, length: number = 12): string => {
    if (text in cache) {
      const label = pad(text, length, " ");
      const hex = chooseColor();
      cache[text] = chalk.bgHex(hex).black(label);
    }

    return cache[text];
  };
})();

export function reportDry<TOptions extends SpotiOptions & { dry?: boolean }>(
  options?: TOptions
): void {
  if (options?.dry) {
    console.log();
    console.log(chalk.blue("This was a dry run. No changes have been saved!"));
  }
}

export function reportStatuses(
  heading: string,
  results: { status: SpotifyStatus }[]
): void {
  const skipped = filter(results, { status: "skipped" }).length;
  const passed = filter(results, { status: "passed" }).length;
  const failed = filter(results, { status: "failed" }).length;

  console.log("");
  console.log(chalk.bold(heading));
  console.log("  " + chalk.grey(skipped) + " Skipped");
  console.log("  " + chalk.green(passed) + " Passed");
  console.log("  " + chalk.red(failed) + " Failed");
}

export function reportErrors(results: { error?: Error }[]): void {
  for (const { error } of results) {
    if (error) {
      console.error("");
      console.error(chalk.red(error.message));
      console.error(chalk.dim.red(error.stack));
    }
  }
}
