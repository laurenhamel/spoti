import {
  AudioFormat,
  type SpotiOptions,
  type SpotifyDownloadResult,
} from "../types";
import { Audio, pool, retry, Format, Library } from "../utils";
import chalk from "chalk";

export async function convertAudioFile<
  TOptions extends SpotiOptions & { format?: AudioFormat }
>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    const dest = item.download.file;
    const src = Library.source(dest);
    const bitrate = item.download.result?.bitrate;

    const padding = 75;

    const passed = (previous: string, next: string) => {
      console.log(
        chalk.green("✓"),
        chalk.dim(Format.truncate(previous, padding)),
        chalk.cyan("→"),
        chalk.green(Format.truncate(next, padding))
      );
    };

    const failed = (previous: string, next: string) => {
      console.log(
        chalk.red("𐄂"),
        chalk.dim(Format.truncate(previous, padding)),
        chalk.cyan("→"),
        chalk.red(Format.truncate(next, padding))
      );
    };

    const error = (previous: string, next: string) => {
      console.log(
        chalk.yellow("?"),
        chalk.dim(Format.truncate(previous, padding)),
        chalk.cyan("→"),
        chalk.yellow(Format.truncate(next, padding))
      );
    };

    if (Library.exists(dest)) {
      src && Library.exists(src) && Library.remove(src);
      passed(src, dest);
    } else if (Library.exists(src)) {
      try {
        await retry(
          () => Audio.convert(Library.path(src), Library.path(dest), bitrate),
          3,
          1000 // 1s
        );
        passed(src, dest);
      } catch (e) {
        failed(src, dest);
      }
    } else {
      error(src, dest);
    }

    progress?.();
    resolve();
  });
}

export async function transformAudioFiles<TOptions extends SpotiOptions>(
  items: SpotifyDownloadResult[],
  options?: TOptions,
  progress?: () => void
): Promise<void[]> {
  const dispatch = pool(25);

  const tasks: (() => Promise<void>)[] = items.map(
    (item) => async () => convertAudioFile(item, options, progress)
  );

  console.log("");

  return dispatch(tasks);
}
