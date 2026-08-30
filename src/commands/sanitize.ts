import { Metadata } from "../core/metadata";
import { Spoti } from "../core/spoti";
import { type SpotiOptions } from "../types/config";
import { type SpotifyMetadataResult } from "../types/spotify";
import { createAction } from "../utils/action";
import { prepareDownloadResults } from "../utils/downloads";
import { Format } from "../utils/format";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import chalk from "chalk";
import { Command } from "commander";
import { castArray, map, trimStart } from "lodash-es";
import { existsSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

export type SanitizeCliArgs = [string];

export interface SanitizeCliOptions extends SpotiOptions {}

export default new Command()
  .name("sanitize")
  .description("Sanitize file name(s)")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .action(
    createAction<SanitizeCliArgs, SanitizeCliOptions>(async (file, options) => {
      const files: string[] = [];

      if (file && Library.exists(file)) {
        files.push(file);
      } else if (file && Metadata.has(file)) {
        const { type, id } = Metadata.read<SpotifyMetadataResult>(file);
        const search = await Spoti.search(id, type, options);
        const items = castArray(search);
        const prepared = prepareDownloadResults(options)(items);
        const paths = map(prepared, "download.path") as string[];
        const sorted = paths.sort();
        files.push(...sorted);
      } else {
        const sorted = Library.files.sort();
        files.push(...sorted);
      }

      const progress = new Progress({
        label: "Sanitizing…",
        total: files.length,
        color: chalk.blue,
      });

      const skip: string[] = [];
      const rename: string[] = [];
      const miss: string[] = [];

      const skipped = (file: string): void => {
        return console.log(chalk.green(`✓`), file);
      };

      const renamed = (previous: string, next: string): void => {
        return console.log(chalk.cyan("→"), chalk.dim(previous), next);
      };

      const missing = (file: string): void => {
        return console.log(chalk.red(`𐄂`), file);
      };

      for (const file of files) {
        const prefix = file.startsWith(Format.HIDDEN_FILE_PREFIX) ? "." : "";
        const clean = trimStart(file, Format.HIDDEN_FILE_PREFIX);
        const [base, ...exts] = basename(clean).split(".");
        const ext = "." + exts.join(".");
        const sanitized = Format.sanitize(base);
        const next = `${prefix}${sanitized}${ext}`;
        const src = join(Library.dir, file);
        const dest = join(Library.dir, next);

        if (existsSync(src)) {
          if (src !== dest) {
            const temp = dest + ".temp";
            renameSync(src, temp);
            renameSync(temp, dest);
            renamed(file, next);
            rename.push(next);
          } else {
            skipped(next);
            skip.push(next);
          }
        } else {
          missing(file);
          miss.push(file);
        }

        progress.increment();
      }

      progress.done();

      console.log("");
      console.log(chalk.bold("Results:"));
      console.log(
        chalk.cyan("→"),
        `Renamed ${chalk.cyan(rename.length)} file(s).`
      );
      console.log(
        chalk.green("✓"),
        `Skipped ${chalk.green(skip.length)} file(s).`
      );
      console.log(chalk.red("𐄂"), `Missed ${chalk.red(miss.length)} file(s).`);
    })
  );
