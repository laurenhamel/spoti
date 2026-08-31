import { Spotify, type Youtube } from "../models";
import { YoutubeApi } from "../services";
import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type ProcessExitRegister } from "../types/process";
import {
  type SpotifyDownloadPreparer,
  type SpotifyDownloadResult,
  type SpotifySearchResult,
} from "../types/spotify";
import { VideoFormat } from "../types/video";
import {
  type YoutubeSearchResult,
  type YoutubeDownloadResult,
} from "../types/youtube";
import { transformAudioFiles, Audio } from "../utils/audio";
import { silenceWarnings } from "./console";
import { Format } from "./format";
import { Library } from "./library";
import { Progress } from "./progress";
import { pool } from "./promise";
import { hydrateTrackTags } from "./tags";
import chalk from "chalk";
import { map } from "lodash-es";

export function getDownloadData(
  title: string,
  bitrate: number
): Record<AudioFormat | VideoFormat, Youtube.Download> {
  const data: Record<AudioFormat | VideoFormat, Youtube.Download> = {
    [AudioFormat.M4A]: {
      file: Format.hide(Library.file(title, AudioFormat.M4A)),
      path: Format.hide(Library.path(title, AudioFormat.M4A)),
      format: AudioFormat.M4A,
      bitrate,
    },
    [AudioFormat.MP3]: {
      file: Library.file(title, AudioFormat.MP3),
      path: Library.path(title, AudioFormat.MP3),
      format: AudioFormat.MP3,
      bitrate,
    },
    [AudioFormat.WAV]: {
      file: Library.file(title, AudioFormat.WAV),
      path: Library.path(title, AudioFormat.WAV),
      format: AudioFormat.WAV,
      bitrate,
    },
    [AudioFormat.AAC]: {
      file: Library.file(title, AudioFormat.AAC),
      path: Library.path(title, AudioFormat.AAC),
      format: AudioFormat.AAC,
      bitrate,
    },
    [VideoFormat.MP4]: {
      file: Format.hide(Library.file(title, VideoFormat.MP4)),
      path: Format.hide(Library.path(title, VideoFormat.MP4)),
      format: VideoFormat.MP4,
      bitrate,
    },
  };

  return data;
}

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
>(item: SpotifySearchResult, options?: TOptions): SpotifyDownloadResult {
  const format = options?.format ?? Audio.DEFAULT_FORMAT;
  const file = Format.file(item.item, format);
  const path = Library.path(file);
  const title = Library.title(file);
  const download = { file, path, format, title };
  return { ...item, download };
}

/** @deprecated */
export function prepareDownloadResults<TOptions extends SpotiOptions>(
  items: SpotifySearchResult[],
  options?: TOptions
): SpotifyDownloadResult[] {
  return map(items, (item) => createDownloadResult(item, options)).sort(
    sortDownloadResults((item) => item.download.file)
  );
}

const prepareNoop: SpotifyDownloadPreparer<Spotify.Type> = () => [];

export const prepareTrack: SpotifyDownloadPreparer<Spotify.Type.TRACK> = (
  data,
  results,
  options
) => {
  const search = results[0];
  const item = { item: data } as Spotify.Item;
  const result: SpotifySearchResult = { ...item, search };
  const prepared = [createDownloadResult(result, options)];
  return prepared.sort(sortDownloadResults((item) => item.download.file));
};

export function prepareTracks<TOptions extends SpotiOptions>(
  data: Spotify.Track[],
  results: YoutubeSearchResult[],
  options?: TOptions
): SpotifyDownloadResult[] {
  return data.flatMap((track, i) => {
    const search = [results[i]];
    return prepareTrack(track, search, options);
  });
}

export const preparePlaylist: SpotifyDownloadPreparer<Spotify.Type.PLAYLIST> = (
  data,
  results,
  options
) => {
  const prepared: SpotifyDownloadResult[] = [];

  for (let i = 0; i < data.items.items.length; i++) {
    const item = data.items.items[i];
    const search = results[i];
    const result: SpotifySearchResult = { ...item, search };
    prepared.push(createDownloadResult(result, options));
  }

  return prepared.sort(sortDownloadResults((item) => item.download.file));
};

export function prepareDownloadType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options?: TOptions
): SpotifyDownloadResult[] {
  const callees: Record<Spotify.Type, SpotifyDownloadPreparer<Spotify.Type>> = {
    [Spotify.Type.ALBUM]: prepareNoop,
    [Spotify.Type.ARTIST]: prepareNoop,
    [Spotify.Type.FEATURES]: prepareNoop,
    [Spotify.Type.PLAYLIST]: preparePlaylist,
    [Spotify.Type.TRACK]: prepareTrack,
    [Spotify.Type.USER]: prepareNoop,
  };

  const callee = callees[type];

  return callee<TOptions>(data, results, options);
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
  const prepared = prepareDownloadResults(items, options);
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

  const downloading = new Progress({
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
  const converting = new Progress({
    label: "Converting…",
    total: passed.length,
    color: chalk.blue,
  });

  await transformAudioFiles(passed, options, () => converting.increment());

  converting.done();
  /* #endregion */

  /* #region Tag */
  const tagging = new Progress({
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
