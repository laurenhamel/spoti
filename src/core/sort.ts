import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/configuration";
import { mergeOptions } from "../utils/action";
import { reportDry } from "../utils/console";
import { Format } from "../utils/format";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import chalk from "chalk";
import { pool } from "../utils/promise";
import { parseGenres } from "../utils/tags";
import { getConfigurationKey } from "../utils/configuration";
import { every, trim, trimStart } from "lodash-es";
import { existsSync, renameSync, mkdirSync, statSync  } from 'node:fs';
import { type LibraryFile } from "../types/library";
import { basename, dirname, extname, join, sep } from "node:path";
import { globSync } from 'glob';

export type SortArguments = [string, string?];

export interface SortOptions extends SpotiOptions {
  cache: boolean;
  dry: boolean;
}

const SORT_DEFAULTS: SortOptions = {
  cache: true,
  dry: false,
  verbose: false,
};

const ADDITIONAL_PLACEHOLDERS: `{${string}}`[] = [
  '{created}',
  '{created-year}',
  '{created-month}',
  '{created-date}',
];

export const sort: ActionHandler<SortArguments, SortOptions> = async <
  TOptions extends SortOptions,
>(
  format: string,
  file?: string,
  config?: TOptions
) => {
  if (!Format.valid(format, ADDITIONAL_PLACEHOLDERS)) throw new Error('Invalid format.');

  if (!format.includes(sep)) throw new Error('Format must include at least one folder.');

  if (!format.endsWith(Format.FILE)) throw new Error(`Format must end with '${Format.FILE}'.`);
  
  const options = await mergeOptions(SORT_DEFAULTS, config);
  const manifest = await Library.manifest(file, options);

  const progress = new Progress({
    label: "Sorting",
    total: manifest.files.length,
    color: chalk.blue,
  });

  const skipped = (() => {
    const files: string[] = [];

    const handler = function (file: string) {
      files.push(file);
      return console.log(chalk.green(`✓`), file);
    };

    handler.files = files;

    return handler;
  })();

  const failed = (() => {
    const files: string[] = [];

    const handler = function (file: string) {
      files.push(file);
      return console.log(chalk.red(`𐄂`), file);
    };

    handler.files = files;

    return handler;
  })();

  const sorted = (() => {
    const files: string[] = [];

    const handler = function (previous: string, next: string) {
      files.push(next);
      return console.log(chalk.blue("→"), chalk.dim(previous), "→", next);
    };

    handler.files = files;

    return handler;
  })();

  const delimiter = await getConfigurationKey('tags.genreDelimiter');

  const parse = async (file: LibraryFile): Promise<Record<string, unknown>> => {
    const { tags, duration, id } = await file.metadata();
    const { birthtime } = statSync(file.file);
    const artists = tags.artist?.split(',').map(trim) ?? [];
    const artist = artists[0];
    const genres = parseGenres(tags.genre, delimiter);
    const genre = genres[0];
    const ext = trimStart(extname(file.file), '.');
    const created = birthtime.toLocaleDateString().replaceAll('/', '-');
    
    return {
      ...tags,
      'album-artists': artists,
      'album-artist': artist,
      artists,
      artist,
      created,
      'created-year': birthtime.getFullYear(),
      'created-month': birthtime.getMonth(),
      'created-date': birthtime.getDate(),
      duration,
      ext,
      genres,
      genre,
      id,
      file: file.file
    };
  };

  const tasks = manifest.files.map((file) => async () => {
    const data = await parse(file);
    const inspect = Format.inspect(format, data);
    const actual = file.file;

    // Skips files that cannot be properly sorted based on the given format due to missing data
    if (!every(Object.values(inspect))) {
      skipped(actual);
      progress.increment();
      return;
    }

    const expected = Format.replace(format, data, false);

    if (actual !== expected) {
      const files = new Set<string>([actual]);
      const base = basename(actual, extname(actual));

      globSync(`*(.|._)${base}.*`, { nodir: true }).forEach(file => {
        files.add(file);
      });

      const from = dirname(actual);
      const to = dirname(expected);

      if (!options.dry && !existsSync(to)) mkdirSync(to, { recursive: true });

      for (const file of Array.from(files)) {
        const src = join(from, file);
        const dest = join(to, file);

        try {
          if (!options.dry) renameSync(src, dest);
        } catch {
          if (src === actual) failed(src);
        }
      }

      sorted(actual, expected);
    } else {
      skipped(actual);
    }

    progress.increment();
  });

  const dispatch = pool(25);
  await dispatch(tasks);
  progress.done();
  console.log();
  console.log(chalk.bold("Summary:"));
  // prettier-ignore
  console.log(chalk.blue("→"), `Sorted ${chalk.blue(sorted.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.green("✓"), `Skipped ${chalk.green(skipped.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.red("𐄂"), `Failed to sort ${chalk.red(failed.files.length)} file(s).`);

  reportDry(options);
};
