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
  Audio,
  Format,
  Library,
  pool,
  Progress,
  silenceWarnings,
} from "../utils";
import chalk from "chalk";
import { transformAudioFiles } from "./audio";
import { hydrateTrackTags } from "./tags";
import { AudioFormat, type ProcessExitRegister } from "../types";

export async function downloadYoutubeSong<TOptions extends SpotiOptions>(
  title: string,
  song: Youtube.Song,
  options?: TOptions
): Promise<YoutubeDownloadResult> {
  return YoutubeApi.downloadSong(
    {
      title,
      song,
    },
    options
  );
}

export function createDownloadResult<
  TOptions extends SpotiOptions & { format?: AudioFormat }
>(options?: TOptions): (item: SpotifySearchResult) => SpotifyDownloadResult {
  return (item) => {
    const format = options?.format ?? Audio.DEFAULT_FORMAT;
    const file = Format.file(item.track, format);
    const path = Library.path(file);
    const title = Library.title(file);
    const download = { file, path, format, title };
    return { ...item, download };
  };
}

export function prepareDownloadResults<TOptions extends SpotiOptions>(
  options?: TOptions
): (items: SpotifySearchResult[]) => SpotifyDownloadResult[] {
  return (items) =>
    map(items, createDownloadResult(options)).sort(
      sortDownloadResults((item) => item.download.file)
    );
}

export function sortDownloadResults<TData = any>(
  callback: (data: TData) => string = (data) => (data as any).toString(),
  order: "ASC" | "DESC" = "ASC"
): (a: TData, b: TData) => number {
  const factor = order === "ASC" ? 1 : -1;

  return (a, b) => {
    const A = callback(a);
    const B = callback(b);
    return A.localeCompare(B) * factor;
  };
}

export async function downloadSpotifyTracks<TOptions extends SpotiOptions>(
  items: SpotifySearchResult[],
  options?: TOptions
): Promise<{
  passed: SpotifyDownloadResult[];
  failed: { error: Error; item: SpotifyDownloadResult }[];
}> {
  const prepared = prepareDownloadResults(options)(items);
  const existing: SpotifyDownloadResult[] = [];
  const missing: SpotifyDownloadResult[] = [];

  for (const item of prepared) {
    const { file, path, format } = item.download;
    const exists = Library.exists(file);
    item.download.result = exists ? { file, path, format } : undefined;
    const stack = exists ? existing : missing;
    stack.push(item);
  }

  const restoreWarnings = silenceWarnings();

  /* #region Download */
  const download = pool(25);
  const downloads: (() => Promise<void>)[] = [];
  const passed: SpotifyDownloadResult[] = [...existing];
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
    ...existing.map(
      (item) => () =>
        new Promise<void>((resolve) => {
          console.log(chalk.green("✓"), item.download.title);
          download$.report();
          resolve();
        })
    )
  );

  downloads.push(
    ...missing.map((item) => async () => {
      const { download, search } = item;
      const { title, file } = download;
      const { result } = search;
      const source = Library.source(file);

      if (Library.exists(source)) {
        download$.report();
        passed.push(item);
        return;
      } else if (result) {
        try {
          download.result = await downloadYoutubeSong(title, result, options);
          console.log(chalk.green("✓"), title);
          download$.report();
          passed.push(item);
          return;
        } catch (e) {
          const error = e as Error;
          console.log(chalk.red("𐄂"), title);
          download$.report();
          failed.push({ error, item });
          return;
        }
      } else {
        const error = new Error(
          `No Youtube search result available to download for '${title}'.`
        );
        console.log(chalk.red("𐄂"), title);
        download$.report();
        failed.push({ error, item });
        return;
      }
    })
  );

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

  return { passed, failed };
}

export function cleanDownloadRemnants<TOptions extends SpotiOptions>(
  options?: TOptions
): void {
  // @TODO Clean up remnants of m4a/mp4 files
  // @TODO Look for any zero-byte/zero-duration MP3 files to delete
}

export const gracefullyCleanupDownloads: ProcessExitRegister = () => ({
  SIGINT: () => {
    cleanDownloadRemnants();
  },
  SIGTERM: () => {
    cleanDownloadRemnants();
  },
});
