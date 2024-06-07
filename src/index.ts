import { Command } from "commander";
import { sync as glob } from "glob";
import pkg from "../package.json";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import "dotenv/config";
import { gracefullyCleanupDownloads } from "./core";
import {
  Progress,
  registerProcessExitHandlers,
  gracefullyStopProcess,
} from "./utils";

(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  console.log("Hello from Spoti!");

  const commands = glob(join(resolve(__dirname, "./commands"), "*.ts"), {
    nodir: true,
  });

  const program = new Command()
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .option("--verbose", "Output more information data", false)
    .allowUnknownOption(true);

  for (const file of commands) {
    const command = (await import(file)).default;
    program.addCommand(command);
  }

  registerProcessExitHandlers(
    gracefullyStopProcess(),
    Progress.gracefullyStopProgress(),
    gracefullyCleanupDownloads()
  );

  try {
    await program.parseAsync(process.argv);
    console.log();
    console.log("Done!", "Thanks for using Spoti!");
    process.exit(0);
  } catch (e) {
    const error = e as Error;
    const options = program.opts();
    console.error();
    console.error(chalk.red(error.message));
    options.verbose && console.error(chalk.dim(error.stack));
    process.exit(1);
  }
})();
