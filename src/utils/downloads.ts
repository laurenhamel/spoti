import { Spotify, type Youtube } from "../models";
import { YoutubeApi } from "../services";
import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type ProcessExitRegister } from "../types/process";
import {
  type SpotifyDownloadResult,
  type SpotifyDownloadPreparer,
  type SpotifyDownloadTarget,
  type SpotifySearchResult,
} from "../types/spotify";
import { VideoFormat } from "../types/video";
import {
  type YoutubeSearchResult,
  type YoutubeDownloadResult,
} from "../types/youtube";
import { Audio } from "../utils/audio";
import { silenceWarnings } from "./console";
import { Format } from "./format";
import { Library } from "./library";
import { Progress } from "./progress";
import { pool } from "./promise";
import chalk from "chalk";
import { map, merge } from "lodash-es";

export function detectDownloadFormat(
  format: string | AudioFormat | VideoFormat
): AudioFormat | VideoFormat {
  const mime = format.split(";")[0].trim();

  const mimes: Record<string, AudioFormat | VideoFormat> = {
    "video/mp4": VideoFormat.MP4,
    "audio/mp4": AudioFormat.M4A,
    "audio/mp3": AudioFormat.MP3,
    "audio/aac": AudioFormat.AAC,
    "audio/wav": AudioFormat.WAV,
  };

  return mimes[mime] ?? format;
}

export function getDownloadPath(
  title: string,
  source: Pick<Youtube.Download, "bitrate" | "duration" | "length"> & {
    mime: string;
  },
  target?: AudioFormat | VideoFormat,
  hidden: boolean = false
): Youtube.Download {
  const { bitrate, duration, length } = source;
  const mime = target ?? source.mime;
  const format = detectDownloadFormat(mime);

  const paths: Record<AudioFormat | VideoFormat, Youtube.Download> = {
    [AudioFormat.M4A]: {
      file: Library.file(title, AudioFormat.M4A),
      path: Library.path(title, AudioFormat.M4A),
      format: AudioFormat.M4A,
      bitrate,
      length,
      duration,
    },
    [AudioFormat.MP3]: {
      file: Library.file(title, AudioFormat.MP3),
      path: Library.path(title, AudioFormat.MP3),
      format: AudioFormat.MP3,
      bitrate,
      length,
      duration,
    },
    [AudioFormat.WAV]: {
      file: Library.file(title, AudioFormat.WAV),
      path: Library.path(title, AudioFormat.WAV),
      format: AudioFormat.WAV,
      bitrate,
      length,
      duration,
    },
    [AudioFormat.AAC]: {
      file: Library.file(title, AudioFormat.AAC),
      path: Library.path(title, AudioFormat.AAC),
      format: AudioFormat.AAC,
      bitrate,
      length,
      duration,
    },
    [VideoFormat.MP4]: {
      file: Library.file(title, VideoFormat.MP4),
      path: Library.path(title, VideoFormat.MP4),
      format: VideoFormat.MP4,
      bitrate,
      length,
      duration,
    },
  };

  const path = paths[format];

  if (hidden) {
    path.file = Format.hide(path.file);
    path.path = Format.hide(path.path);
  }

  return path;
}

export async function downloadYoutubeSong<TOptions extends SpotiOptions>(
  title: string,
  song: Youtube.Song,
  options?: TOptions
): Promise<YoutubeDownloadResult> {
  return YoutubeApi.downloadSong({ title, song }, options);
}

export function createDownloadTarget<
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(item: SpotifySearchResult, options?: TOptions): SpotifyDownloadTarget {
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
): SpotifyDownloadTarget[] {
  return map(items, (item) => createDownloadTarget(item, options)).sort(
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
  const prepared = [createDownloadTarget(result, options)];
  return prepared.sort(sortDownloadResults((item) => item.download.file));
};

export function prepareTracks<TOptions extends SpotiOptions>(
  data: Spotify.Track[],
  results: YoutubeSearchResult[],
  options?: TOptions
): SpotifyDownloadTarget[] {
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
  const prepared: SpotifyDownloadTarget[] = [];

  for (let i = 0; i < data.items.items.length; i++) {
    const item = data.items.items[i];
    const search = results[i];
    const result: SpotifySearchResult = { ...item, search };
    prepared.push(createDownloadTarget(result, options));
  }

  return prepared.sort(sortDownloadResults((item) => item.download.file));
};

export function prepareDownloadTargets<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options?: TOptions
): SpotifyDownloadTarget[] {
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

export async function downloadSpotifyTrack<
  TOptions extends SpotiOptions & { force?: boolean },
>(
  target: SpotifyDownloadTarget,
  options?: TOptions,
  progress?: () => void
): Promise<SpotifyDownloadResult> {
  const { title, file, path, format } = target.download;

  const item = merge({}, target, {
    download: {
      result: {
        file,
        path,
        format,
      },
    },
  }) as SpotifyDownloadResult["item"];

  // Final audio file already exists
  if (options?.force ? false : Library.exists(file)) {
    console.log(chalk.gray("◦"), title);
    progress?.();
    return { item, status: "skipped" };
  }

  const source = Library.source(file);

  // Temporary source file already exists
  if (Library.exists(source)) {
    console.log(chalk.green("✓"), title);
    progress?.();
    return { item, status: "passed" };
  }

  const search = target.search.result;

  // Search result available
  if (search) {
    const restoreWarnings = silenceWarnings();

    try {
      const result = await downloadYoutubeSong(title, search, options);
      console.log(chalk.green("✓"), title);
      return { item: merge(item, { download: { result } }), status: "passed" };
    } catch (e) {
      const error = e as Error;
      console.log(chalk.red("𐄂"), title);
      return { item, status: "failed", error };
    } finally {
      progress?.();
      restoreWarnings();
    }
  }

  // Search result unavailable
  const error = new Error(`Missing YouTube search result for '${title}'.`);
  console.log(chalk.red("𐄂"), title);
  progress?.();
  return { item, status: "failed", error };
}

export async function downloadSpotifyTracks<
  TOptions extends SpotiOptions & { force?: boolean },
>(
  targets: SpotifyDownloadTarget[],
  options?: TOptions
): Promise<SpotifyDownloadResult[]> {
  const progress = new Progress({
    label: "Downloading…",
    total: targets.length,
    color: chalk.blue,
  });

  const tasks = targets.map(
    (target) => () =>
      downloadSpotifyTrack(target, options, () => progress.increment())
  );

  const dispatch = pool(25);
  const downloads = await dispatch(tasks);
  progress.done();
  return downloads;
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
