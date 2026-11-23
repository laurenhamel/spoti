import { type Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/configuration";
import { type LibraryFile } from "../types/library";
import { mergeOptions } from "../utils/action";
import { reportDry } from "../utils/console";
import { prepareTracks } from "../utils/downloads";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import { searchSongs } from "../utils/search";
import { getSpotifyTracks, searchSpotifyTracks } from "../utils/spotify";
import chalk from "chalk";
import { map } from "lodash-es";
import { renameSync } from 'node:fs';

export type RenameArguments = [string];

export interface RenameOptions extends SpotiOptions {
  cache: boolean;
  dry: boolean;
}

const RENAME_DEFAULTS: RenameOptions = {
  cache: true,
  dry: false,
  verbose: false,
};

export const rename: ActionHandler<RenameArguments, RenameOptions> = async <
  TOptions extends RenameOptions,
>(
  file?: string,
  config?: TOptions
) => {
  const options = await mergeOptions(RENAME_DEFAULTS, config);
  const manifest = await Library.manifest(file, options);

  const scanning = new Progress({
    label: "Scanning…",
    total: manifest.files.length,
    color: chalk.blue,
  });

  const tracks: {
    file: LibraryFile;
    track: Spotify.Track;
  }[] = [];

  const ids: {
    file: LibraryFile;
    id: string;
  }[] = [];

  const files: LibraryFile[] = [];

  for (const file of manifest.files) {
    if (file.item) {
      tracks.push({ file, track: file.item.item });
    } else {
      const { id } = await file.metadata();
      id ? ids.push({ file, id }) : files.push(file);
    }

    scanning.increment();
  }

  scanning.done();

  const known = await getSpotifyTracks(map(ids, "id"), options);

  known.forEach((track, i) => {
    const { file } = ids[i];
    file.item = { item: track } as Spotify.Item;
    tracks.push({ file, track });
  });

  const unknown = await searchSpotifyTracks(files, options);

  unknown.forEach((track, i) => {
    const file = files[i];
    file.item = { item: track } as Spotify.Item;
    tracks.push({ file, track });
  });

  const items = map(tracks, 'track').map((item) => ({ item })) as Spotify.Item[];
  const results = await searchSongs(items, options);
  const targets = prepareTracks(map(tracks, "track"), results, options);

  const progress = new Progress({
      label: "Renaming",
      total: targets.length,
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

  const renamed = (() => {
    const files: string[] = [];

    const handler = function (previous: string, next: string) {
      files.push(next);
      return console.log(chalk.blue("→"), chalk.dim(previous), "→", next);
    };

    handler.files = files;

    return handler;
  })();

  targets.forEach((target, i) => {
    const { file } = tracks[i];
    const actual = file.title;
    const expected = target.download.title;

    if (actual !== expected) {
      if (!options.dry) {
        const src = file.file;
        const dest = target.download.file;
        const temp = dest + ".temp";
        renameSync(src, temp);
        renameSync(temp, dest);
      }

      renamed(actual, expected);
    } else {
      skipped(actual);
    }
  });

  progress.done();
  console.log();
  console.log(chalk.bold("Summary:"));
  // prettier-ignore
  console.log(chalk.blue("→"), `Renamed ${chalk.blue(renamed.files.length)} file(s).`);
  // prettier-ignore
  console.log(chalk.green("✓"), `Skipped ${chalk.green(skipped.files.length)} file(s).`);

  reportDry(options);
};
