import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Format } from "../utils/format";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import chalk from "chalk";
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

export type SanitizeArguments = [string];

export interface SanitizeOptions extends SpotiOptions {
  cache: boolean;
  clean: boolean;
  dry: boolean;
}

const SANITIZE_DEFAULTS: SanitizeOptions = {
  cache: true,
  clean: false,
  dry: false,
  verbose: false,
};

export const sanitize: ActionHandler<
  SanitizeArguments,
  SanitizeOptions
> = async <TOptions extends SanitizeOptions>(
  file?: string,
  config?: TOptions
) => {
  const options = mergeOptions(SANITIZE_DEFAULTS, config);
  const manifest = await Library.manifest(file, options);

  const progress = new Progress({
    label: "Sanitizing",
    total: manifest.files.length,
    color: chalk.blue,
  });

  const cleaned = (() => {
    const files: string[] = [];

    const handler = function (file: string) {
      files.push(file);
      return console.log(chalk.red(`𐄂`), file);
    };

    handler.files = files;

    return handler;
  })();

  const skipped = (() => {
    const files: string[] = [];

    const handler = function (file: string) {
      files.push(file);
      return console.log(chalk.green(`✓`), file);
    };

    handler.files = files;

    return handler;
  })();

  const renamed = (() => {
    const files: string[] = [];

    const handler = function (previous: string, next: string) {
      files.push(next);
      return console.log(chalk.blue("→"), chalk.dim(previous), "→", next);
    };

    handler.files = files;

    return handler;
  })();

  const missing = (() => {
    const files: string[] = [];

    const handler = function (file: string) {
      files.push(file);
      return console.log(chalk.gray(`◦`), file);
    };

    handler.files = files;

    return handler;
  })();

  for (const { file } of manifest.files) {
    const parsed = Format.parse(file);
    const sanitized = { ...parsed, base: Format.sanitize(parsed.base) };
    const next = Format.unparse(sanitized);
    const src = join(Library.dir, file);
    const dest = join(Library.dir, next);
    const exists = existsSync(src);

    // Clean temporary files
    if (exists && Format.isHidden(file) && options.clean) {
      if (!options.dry) {
        rmSync(file);
      }

      cleaned(file);
    }

    // Rename unsanitized files
    else if (exists && src !== dest) {
      if (!options.dry) {
        const temp = dest + ".temp";
        renameSync(src, temp);
        renameSync(temp, dest);
      }

      renamed(file, next);
    }

    // Skip sanitized files
    else if (exists && src === dest) {
      skipped(file);
    }

    // Report missing files
    else if (!exists) {
      missing(file);
    }

    progress.increment();
  }

  progress.done();
  console.log();
  console.log(chalk.bold("Summary:"));
  // prettier-ignore
  options.clean && console.log(chalk.red("𐄂"), `Cleaned ${chalk.red(cleaned.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.blue("→"), `Renamed ${chalk.blue(renamed.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.green("✓"), `Skipped ${chalk.green(skipped.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.gray("◦"), `Missing ${chalk.gray(missing.files.length)} file(s).`);

  if (options.dry) {
    console.log();
    console.log(chalk.blue("This was a dry run. No changes have been saved!"));
  }
};
