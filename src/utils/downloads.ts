import { transformAudioFiles } from "../core/audio";
import { hydrateTrackTags } from "../core/tags";
import { type Youtube } from "../models";
import { YoutubeApi } from "../services";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type ProcessExitRegister } from "../types/process";
import {
  type SpotifyDownloadResult,
  type SpotifySearchResult,
} from "../types/spotify";
import { type YoutubeDownloadResult } from "../types/youtube";
import { Audio } from "./audio";
import { silenceWarnings } from "./console";
import { Format } from "./format";
import { Library } from "./library";
import { ProgressV2 } from "./progress";
import { pool } from "./promise";
import chalk from "chalk";
import { map } from "lodash-es";

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
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(options?: TOptions): (item: SpotifySearchResult) => SpotifyDownloadResult {
  return (item) => {
    const format = options?.format ?? Audio.DEFAULT_FORMAT;
    const file = Format.file(item.item, format);
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

export function sortDownloadResults<TData = Record<string, unknown>>(
  callback: (data: TData) => string,
  order: "ASC" | "DESC" = "ASC"
): (a: TData, b: TData) => number {
  const factor = order === "ASC" ? 1 : -1;

  return (a, b) => {
    const A = callback(a);
    const B = callback(b);
    return A.localeCompare(B) * factor;
  };
}

export async function downloadSpotifyTracks<
  TOptions extends SpotiOptions & { force?: boolean },
>(
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
    const exists = options?.force ? false : Library.exists(file);
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

  const downloading = new ProgressV2({
    label: "Downloading…",
    total: prepared.length,
    color: chalk.blue,
  });

  downloads.push(
    ...existing.map(
      (item) => () =>
        new Promise<void>((resolve) => {
          console.log(chalk.green("✓"), item.download.title);
          downloading.increment();
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
        downloading.increment();
        passed.push(item);
        return;
      } else if (result) {
        try {
          download.result = await downloadYoutubeSong(title, result, options);
          console.log(chalk.green("✓"), title);
          downloading.increment();
          passed.push(item);
          return;
        } catch (e) {
          const error = e as Error;
          console.log(chalk.red("𐄂"), title);
          downloading.increment();
          failed.push({ error, item });
          return;
        }
      } else {
        const error = new Error(
          `No Youtube search result available to download for '${title}'.`
        );
        console.log(chalk.red("𐄂"), title);
        downloading.increment();
        failed.push({ error, item });
        return;
      }
    })
  );

  await download(downloads);

  downloading.done();
  /* #endregion */

  /* #region Convert */
  const converting = new ProgressV2({
    label: "Converting…",
    total: passed.length,
    color: chalk.blue,
  });

  await transformAudioFiles(passed, options, () => converting.increment());

  converting.done();
  /* #endregion */

  /* #region Tag */
  const tagging = new ProgressV2({
    label: "Tagging…",
    total: passed.length,
    color: chalk.blue,
  });

  await hydrateTrackTags(passed, options, () => tagging.increment());

  tagging.done();
  /* #endregion */

  restoreWarnings();

  return { passed, failed };
}

export function cleanDownloadRemnants<TOptions extends SpotiOptions>(
  _options?: TOptions
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
