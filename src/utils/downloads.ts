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
import { createLabel, silenceWarnings } from "./console";
import { Format } from "./format";
import { Library } from "./library";
import { Progress } from "./progress";
import { pool } from "./promise";
import chalk from "chalk";
import { find, merge } from "lodash-es";

export function detectDownloadType(
  metadata: Youtube.Metadata
): "audio" | "video" {
  const { ext } = metadata;

  return (Object.values(VideoFormat) as string[]).includes(ext)
    ? "video"
    : "audio";
}

export function detectDownloadBitrate(
  type: "audio" | "video",
  metadata: Youtube.Metadata
): number {
  if (type === "audio") return metadata.abr;
  if (type === "video") return metadata.vbr;
  return metadata.tbr;
}

export function detectDownloadSize(
  type: "audio" | "video",
  metadata: Youtube.Metadata
): number {
  return metadata.filesize_approx;
}

export function detectDownloadDuration(
  type: "audio" | "video",
  metadata: Youtube.Metadata
): number {
  return metadata.duration * 1000;
}

export function detectDownloadFormat(
  type: "audio" | "video",
  metadata: Youtube.Metadata
): AudioFormat | VideoFormat {
  const exts: Record<string, AudioFormat | VideoFormat> = {
    mp4: VideoFormat.MP4,
    m4a: AudioFormat.M4A,
    webm: AudioFormat.WEBM,
    mp3: AudioFormat.MP3,
    aac: AudioFormat.AAC,
    wav: AudioFormat.WAV,
  };

  const fallbacks: Record<"audio" | "video", AudioFormat | VideoFormat> = {
    audio: AudioFormat.M4A,
    video: VideoFormat.MP4,
  };

  return exts[metadata.ext] ?? fallbacks[type];
}

export function getDownloadPath(
  title: string,
  metadata: Youtube.Metadata,
  target?: AudioFormat | VideoFormat,
  hidden: boolean = false
): Youtube.Download {
  const type = detectDownloadType(metadata);
  const format = target ?? detectDownloadFormat(type, metadata);
  const bitrate = detectDownloadBitrate(type, metadata);
  const size = detectDownloadSize(type, metadata);
  const duration = detectDownloadDuration(type, metadata);

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

export function findDownloadPath<
  TOptions extends SpotiOptions & { output?: "audio" | "video" }, // @TODO Add configuration for 'audio' vs. 'video' output preference
>(
  title: string,
  options?: TOptions,
  hidden: boolean = false
): Youtube.DownloadPath {
  const paths = getDownloadPaths(title, hidden);

  const formats: Record<"audio" | "video", AudioFormat | VideoFormat> = {
    audio: Audio.DEFAULT_FORMAT,
    video: VideoFormat.MP4,
  };

  const type = options?.output ?? "audio";
  const format = formats[type];

  return (
    paths.find(({ path }) => Library.exists(path)) ?? find(paths, { format })!
  );
}

export async function downloadYoutubeSong<TOptions extends SpotiOptions>(
  title: string,
  song: Youtube.Song,
  options?: TOptions
): Promise<YoutubeDownloadResult> {
  const meta = await YoutubeApi.getMetadata(title, song, options);
  return await YoutubeApi.downloadSong(meta);
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
  const scope = createLabel("download");
  const { title } = target.download;

  const input = findDownloadPath(title, options, true);
  const output = findDownloadPath(title, options);

  const ready = {
    input: await Library.ready(input.path, { size: 1 }),
    output: await Library.ready(output.path, { size: 1 }),
  };

  const item = merge({}, target, {
    download: {
      title,
      input,
      output,
    },
  }) as SpotifyDownloadResult["item"];

  // Output exists
  if (options?.force ? false : ready.output) {
    console.log(scope, chalk.gray("✓"), title);
    progress?.();
    return { item, status: "skipped" };
  }

  // Input exists
  if (options?.force ? false : ready.input) {
    console.log(scope, chalk.green("✓"), title);
    progress?.();
    return { item, status: "passed" };
  }

  const song = target.search.result;

  // Search result available
  if (song) {
    const restoreWarnings = silenceWarnings();

    try {
      const result = await downloadYoutubeSong(title, song, options);
      console.log(scope, chalk.green("✓"), title);

      return {
        item: merge(item, result, {
          download: {
            result,
          },
        }),
        status: "passed",
      };
    } catch (e) {
      const error = e as Error;
      console.log(scope, chalk.red("𐄂"), title);
      return { item, status: "failed", error };
    } finally {
      progress?.();
      restoreWarnings();
    }
  }

  // Search result unavailable
  const error = new Error(`Missing YouTube search result for '${title}'.`);
  console.log(scope, chalk.red("𐄂"), title);
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
