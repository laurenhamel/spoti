import pkg from "../package.json";
import { registerCommands } from "./utils/commands";
import { gracefullyCleanupDownloads } from "./utils/downloads";
import { loadEnv } from "./utils/environment";
import {
  registerProcessExitHandlers,
  gracefullyStopProcess,
} from "./utils/process";
import { Progress } from "./utils/progress";
import chalk from "chalk";
import { Command } from "commander";

loadEnv();

const program = new Command()
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .option("--verbose", "Output more information", false);

await registerCommands(program);

// @FIXME This isn't actually cleaning up download remnants
registerProcessExitHandlers(
  gracefullyStopProcess(),
  Progress.gracefullyStopProgress(),
  gracefullyCleanupDownloads()
);

try {
  await program.parseAsync(process.argv);
  process.exit(0);
} catch (e) {
  const error = e as Error;
  const options = program.opts();
  console.error();
  console.error(chalk.red(error.message));
  options.verbose && console.error(chalk.dim(error.stack));
  process.exit(1);
}
