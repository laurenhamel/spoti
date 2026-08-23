import pkg from "../package.json";
import { gracefullyCleanupDownloads } from "./core/downloads";
import { registerCommands } from "./utils/commands";
import {
  registerProcessExitHandlers,
  gracefullyStopProcess,
} from "./utils/process";
import { Progress } from "./utils/progress";
import chalk from "chalk";
import { Command } from "commander";
import "dotenv/config";

console.log("Hello from Spoti!");

const program = new Command()
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .option("--verbose", "Output more information", false)
  .allowUnknownOption(true);

await registerCommands(program);

// @FIXME This isn't actually cleaning up download remnants
registerProcessExitHandlers(
  gracefullyStopProcess(),
  Progress.gracefullyStopProgress(),
  gracefullyCleanupDownloads()
);

try {
  await program.parseAsync(process.argv);
  console.log("");
  console.log("Done!", "Thanks for using Spoti!");
  console.log("");
  process.exit(0);
} catch (e) {
  const error = e as Error;
  const options = program.opts();
  console.error();
  console.error(chalk.red(error.message));
  options.verbose && console.error(chalk.dim(error.stack));
  process.exit(1);
}
