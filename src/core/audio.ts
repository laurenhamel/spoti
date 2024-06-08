import { type SpotiOptions, type SpotifyDownloadResult } from "../types";
import { convertToMp3, pool, retry, Library } from "../utils";
import { basename } from "node:path";
import chalk from "chalk";

export async function convertAudioFile<TOptions extends SpotiOptions>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const id = item.track.id;
    const dest = item.download.path;
    const src = Library.source(dest);

    const isValid = (file: string) =>
      Library.exists(file) && Library.size(file) > 0;
    const isFound = (id: string) => !!Library.find(id);

    // Skip if the MP3 already exists!
    if (isValid(dest) || isFound(id)) {
      progress?.();
      src && Library.exists(src) && Library.remove(src);
      return resolve();
    } else if (isValid(src)) {
      try {
        await retry(
          () => convertToMp3(Library.path(src), Library.path(dest)),
          3,
          1000 // 1s
        );
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        progress?.();
      }
    } else {
      progress?.();
      reject(
        new Error(
          `Missing M4A/MP4 source file for '${item.download.title}' to convert to MP3.`
        )
      );
    }
  });
}

export async function transformAudioFiles<TOptions extends SpotiOptions>(
  items: SpotifyDownloadResult[],
  options?: TOptions,
  progress?: () => void
): Promise<void[]> {
  const dispatch = pool(25);

  const tasks: (() => Promise<void>)[] = items.map(
    (item) => () => convertAudioFile(item, options, progress)
  );

  return dispatch(tasks);
}
