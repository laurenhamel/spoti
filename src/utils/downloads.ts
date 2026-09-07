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
import { find, map, merge } from "lodash-es";

export function detectDownloadType(source: Youtube.Format): "audio" | "video" {
  return source.acodec !== "none" ? "audio" : "video";
}

export function detectDownloadFormat(
  source: Youtube.Format
): AudioFormat | VideoFormat | undefined {
  const { ext } = source;

  const exts: Record<string, AudioFormat | VideoFormat> = {
    mp4: VideoFormat.MP4,
    m4a: AudioFormat.M4A,
    webm: AudioFormat.WEBM,
    mp3: AudioFormat.MP3,
    aac: AudioFormat.AAC,
    wav: AudioFormat.WAV,
  };

  return exts[ext];
}

export function getDownloadPath(
  title: string,
  metadata: Youtube.Metadata,
  source: Youtube.Format,
  target?: AudioFormat | VideoFormat,
  hidden: boolean = false
): Youtube.Download {
  const type = detectDownloadType(source);
  const format = target ?? detectDownloadFormat(source) ?? AudioFormat.M4A;
  const duration = metadata.duration * 1000;
  // prettier-ignore
  const size = source.filesize ?? source.filesize_approx ?? metadata.filesize_approx;
  // prettier-ignore
  const bitrate = type === 'audio' ? (source.abr ?? metadata.abr) : (source.vbr ?? metadata.vbr);

  let file = Library.file(title, format);
  let path = Library.path(title, format);

  if (hidden) {
    file = Format.hide(file);
    path = Format.hide(path);
  }

  return {
    bitrate,
    duration,
    file,
    format,
    size,
    metadata,
    path,
    source,
    type,
  };
}

export function getAudioPaths(
  title: string,
  hidden: boolean = false
): { format: AudioFormat; file: string; path: string }[] {
  return Object.values(AudioFormat).map((format) => {
    let file = Library.file(title, format);
    let path = Library.path(title, format);

    if (hidden) {
      file = Format.hide(file);
      path = Format.hide(path);
    }

    return { format, file, path };
  });
}

export function getVideoPaths(
  title: string,
  hidden: boolean = false
): { format: VideoFormat; file: string; path: string }[] {
  return Object.values(VideoFormat).map((format) => {
    let file = Library.file(title, format);
    let path = Library.path(title, format);

    if (hidden) {
      file = Format.hide(file);
      path = Format.hide(path);
    }

    return { format, file, path };
  });
}

export function getDownloadPaths(
  title: string,
  hidden: boolean = false
): Youtube.DownloadPath[] {
  return [...getAudioPaths(title, hidden), ...getVideoPaths(title, hidden)];
}

export function extractDownloadPaths(
  paths: Youtube.DownloadPath[]
): Record<"audio" | "video", Youtube.DownloadPath> {
  const audios = paths.filter(({ format }) =>
    Object.values(AudioFormat).includes(format as AudioFormat)
  );

  const videos = paths.filter(({ format }) =>
    Object.values(VideoFormat).includes(format as VideoFormat)
  );

  const audio =
    audios.find(({ path }) => Library.exists(path)) ??
    find(audios, { format: Audio.DEFAULT_FORMAT })!;

  const video = videos.find(({ path }) => Library.exists(path)) ?? videos[0];

  return { audio, video };
}

export async function downloadYoutubeSong<TOptions extends SpotiOptions>(
  title: string,
  song: Youtube.Song,
  options?: TOptions
): Promise<YoutubeDownloadResult> {
  const meta = await YoutubeApi.getMetadata(title, song, options);
  const download = await YoutubeApi.downloadSong(meta);
  await Library.sync();
  return download;
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
  const { title } = target.download;

  const inputs = getDownloadPaths(title, true);
  const outputs = getDownloadPaths(title);

  const item = merge({}, target, {
    download: {
      title,
      inputs: extractDownloadPaths(inputs),
      outputs: extractDownloadPaths(outputs),
    },
  }) as SpotifyDownloadResult["item"];

  // Output file exists
  if (options?.force ? false : Library.contains(map(outputs, "path"))) {
    console.log(chalk.gray("✓"), title);
    progress?.();
    return { item, status: "skipped" };
  }

  // Input file exists
  if (options?.force ? false : Library.contains(map(inputs, "path"))) {
    console.log(chalk.green("✓"), title);
    progress?.();
    return { item, status: "passed" };
  }

  const song = target.search.result;

  // Search result available
  if (song) {
    const restoreWarnings = silenceWarnings();

    try {
      const result = await downloadYoutubeSong(title, song, options);
      console.log(chalk.green("✓"), title);

      return {
        item: merge(item, {
          download: {
            inputs: extractDownloadPaths(inputs),
            outputs: extractDownloadPaths(outputs),
            result,
          },
        }),
        status: "passed",
      };
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
