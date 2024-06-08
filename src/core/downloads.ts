import { Youtube } from "../models";
import {
  type SpotiOptions,
  type YoutubeDownloadResult,
  type SpotifyDownloadResult,
  type SpotifySearchResult,
} from "../types";
import { YoutubeApi } from "../services";
import { map } from "lodash-es";
import {
  Library,
  pool,
  Progress,
  sanitizeFileName,
  silenceWarnings,
} from "../utils";
import chalk from "chalk";
import { transformAudioFiles } from "./audio";
import { hydrateTrackTags } from "./tags";
import { type ProcessExitRegister } from "../types";

export async function downloadYoutubeSong<TOptions extends SpotiOptions>(
  title: string,
  song: Youtube.Song,
  options?: TOptions
): Promise<YoutubeDownloadResult> {
  const dir = options?.pwd ?? (process.env.PWD as string);

  return YoutubeApi.downloadSong(
    {
      dir,
      title,
      song,
    },
    options
  );
}

export async function downloadSpotifyTracks<TOptions extends SpotiOptions>(
  items: SpotifySearchResult[],
  options?: TOptions
): Promise<{
  passed: SpotifyDownloadResult[];
  failed: { error: Error; item: SpotifyDownloadResult }[];
}> {
  const prepared = map<SpotifySearchResult, SpotifyDownloadResult>(
    items,
    (item) => {
      const { track } = item;
      const { artists, name: song } = track;
      const artist = map(artists, "name").join(", ");
      const title = sanitizeFileName(`${artist} - ${song}`);
      const path = Library.file(title, Youtube.AudioFormat.MP3);
      const download = { artist, song, title, path };
      return { ...item, download };
    }
  ).sort((a, b) => {
    const A = map(a.track.artists, "name").join(", ");
    const B = map(b.track.artists, "name").join(", ");
    return A.localeCompare(B);
  });

  const [exists, missing] = prepared.reduce(
    ([exists, missing], item) => {
      const { id } = item.track;
      const { path } = item.download;

      const isValid = (file: string) =>
        Library.exists(file) && Library.size(file) > 0;
      const isFound = (id: string) => !!Library.find(id);

      if (isValid(path) || isFound(id)) {
        item.download.result = {
          title: item.download.title,
          format: Youtube.AudioFormat.MP3,
          path: item.download.path,
        };

        exists.push(item);
      } else {
        missing.push(item);
      }

      return [exists, missing];
    },
    [[] as SpotifyDownloadResult[], [] as SpotifyDownloadResult[]]
  );

  const restoreWarnings = silenceWarnings();

  /* #region Download */
  const download = pool(25);
  const downloads: (() => Promise<void>)[] = [];
  const passed: SpotifyDownloadResult[] = [...exists];
  const failed: { error: Error; item: SpotifyDownloadResult }[] = [];

  const download$ = new Progress(
    "Downloading…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${prepared.length}`,
      nameTransformFn: chalk.blue,
    },
    (() => {
      let reports = 0;

      return (): void => {
        reports++;
        const percentage = reports / prepared.length;
        const message = `${reports} / ${prepared.length}`;
        download$?.update(percentage, message);
      };
    })()
  );

  downloads.push(
    ...exists.map(
      (item) => () =>
        new Promise<void>((resolve) => {
          const { title } = item.download;
          console.log(chalk.green("✓"), title);
          download$.report();
          resolve();
        })
    )
  );

  for (const item of missing) {
    downloads.push(
      () =>
        new Promise<void>(async (resolve) => {
          const { download, search, track } = item;
          const { title, path } = download;
          const { result } = search;
          const { id } = track;

          const isValid = (file: string) =>
            Library.exists(file) && Library.size(file) > 0;
          const isFound = (id: string) => !!Library.find(id);

          // We can skip downloading if the MP3 files already exists!
          if (isValid(path) || isFound(id)) {
            download$.report();
            passed.push(item);
            return resolve();
          }

          if (result) {
            try {
              download.result = await downloadYoutubeSong(
                title,
                result,
                options
              );
              console.log(chalk.green("✓"), title);
              download$.report();
              passed.push(item);
              resolve();
            } catch (e) {
              const error = e as Error;
              console.log(chalk.red("𐄂"), title);
              download$.report();
              failed.push({ error, item });
              resolve();
            }
          } else {
            const error = new Error(
              `No Youtube search result available to download for '${title}'.`
            );
            console.log(chalk.red("𐄂"), title);
            download$.report();
            failed.push({ error, item });
            resolve();
          }
        })
    );
  }

  await download(downloads);

  download$.done();
  download$.remove();
  /* #endregion */

  /* #region Convert */
  const convert$ = new Progress(
    "Converting…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${passed.length}`,
      nameTransformFn: chalk.blue,
    },
    (() => {
      let reports = 0;

      return (): void => {
        reports++;
        const percentage = reports / passed.length;
        const message = `${reports} / ${passed.length}`;
        convert$?.update(percentage, message);
      };
    })()
  );

  await transformAudioFiles(passed, options, () => convert$.report());

  convert$.done();
  convert$.remove();
  /* #endregion */

  /* #region Tag */
  const tag$ = new Progress(
    "Tagging…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${passed.length}`,
      nameTransformFn: chalk.blue,
    },
    (() => {
      let reports = 0;

      return (): void => {
        reports++;
        const percentage = reports / passed.length;
        const message = `${reports} / ${passed.length}`;
        tag$?.update(percentage, message);
      };
    })()
  );

  await hydrateTrackTags(passed, options, () => tag$.report());

  tag$.done();
  tag$.remove();
  /* #endregion */

  restoreWarnings();

  // return { passed, failed };
  return { passed: [], failed: [] };
}

export function cleanDownloadRemnants<TOptions extends SpotiOptions>(
  options?: TOptions
): void {
  // @TODO Clean up remnants of m4a/mp4 files
  // @TODO Look for any zero-byte MP3 files to delete
}

export const gracefullyCleanupDownloads: ProcessExitRegister = () => ({
  SIGINT: () => {
    cleanDownloadRemnants();
  },
  SIGTERM: () => {
    cleanDownloadRemnants();
  },
});
