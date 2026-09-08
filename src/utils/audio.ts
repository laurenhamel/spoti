import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type SpotifyDownloadResult,
  type SpotifyConversionResult,
} from "../types/spotify";
import { type VideoFormat } from "../types/video";
import { createLabel } from "../utils/console";
import { Format } from "../utils/format";
import { pool } from "../utils/promise";
import { Library } from "./library";
import { Progress } from "./progress";
import chalk from "chalk";
import { trimStart } from "lodash-es";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { extname } from "path";

export async function convertAudioFile<
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(
  source: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<SpotifyConversionResult> {
  await Library.sync();

  const scope = createLabel("convert");
  const { title } = source.item.download;

  // Ignore failed and/or skipped downloads
  if (["failed", "skipped"].includes(source.status)) {
    console.log(scope, chalk.gray("✓"), title);
    progress?.();
    return { source, status: "skipped" };
  }

  const { item } = source;
  const { download } = item;
  const { inputs, outputs, result } = download;
  const length = 75;

  const diff = ({ src, dest }: { src: string; dest: string }): string => {
    const from = chalk.dim(Format.truncateFile(basename(src), length));
    const to = chalk.green(Format.truncateFile(basename(dest), length));
    return [from, "→", to].join(" ");
  };

  const audio = {
    src: inputs.audio.path,
    dest: outputs.audio.path,
  };

  const video = {
    src: inputs.video.path,
    dest: outputs.video.path,
  };

  // Delete video files
  if (Library.exists(video.src)) await Library.remove(video.src);
  if (Library.exists(video.dest)) await Library.remove(video.dest);

  // Audio output exists
  if (Library.exists(audio.dest)) {
    // Delete audio input
    if (Library.exists(audio.src)) await Library.remove(audio.src);
    // Refresh library state
    await Library.sync();
    console.log(scope, chalk.green("✓"), title);
    options?.verbose && console.log(scope, chalk.green("✓"), diff(audio));
    progress?.();
    return { source, status: "passed" };
  }

  // Audio input exists
  if (Library.exists(audio.src)) {
    try {
      await Audio.convert(audio.src, audio.dest, result?.outputs.audio.bitrate);
      console.log(scope, chalk.green("✓"), title);
      options?.verbose && console.log(scope, chalk.green("✓"), diff(audio));
      return { source, status: "passed" };
    } catch (e) {
      const error = e as Error;
      console.log(scope, chalk.red("𐄂"), title);
      options?.verbose && console.log(scope, chalk.red("𐄂"), diff(audio));
      return { source, status: "failed", error };
    } finally {
      progress?.();
    }
  }

  // No audio input or output exists –– we should never end up here!
  console.log(scope, chalk.yellow("?"), title);
  options?.verbose && console.log(chalk.yellow("?"), diff(audio));
  const error = new Error("Audio conversion failed.");
  progress?.();
  return { source, status: "failed", error };
}

export async function convertAudioFiles<TOptions extends SpotiOptions>(
  results: SpotifyDownloadResult[],
  options?: TOptions
): Promise<SpotifyConversionResult[]> {
  const progress = new Progress({
    label: "Converting…",
    total: results.length,
    color: chalk.blue,
  });

  const tasks = results.map(
    (target) => () =>
      convertAudioFile(target, options, () => progress.increment())
  );

  const dispatch = pool(25);
  const conversions = await dispatch(tasks);
  progress.done();

  return conversions;
}

export class Audio {
  static readonly DEFAULT_FORMAT: AudioFormat = AudioFormat.MP3;

  /**
   * Detect that audio/video file format
   * @param file - The file to retrieve the format of
   * @returns
   */
  static format<
    TFormat extends AudioFormat | VideoFormat = AudioFormat | VideoFormat,
  >(file: string): TFormat {
    return trimStart(extname(file), ".") as TFormat;
  }

  /**
   * Convert the audio/video file to another format via ffmpeg
   * @param src - The source file
   * @param dest - The destination file
   * @returns
   */
  static async convert(
    src: string,
    dest: string,
    bitrate?: number
  ): Promise<void> {
    const input = '"' + Library.file(src).replace(/"/g, '\\"') + '"';
    const output = '"' + Library.file(dest).replace(/"/g, '\\"') + '"';

    const flags: string[] = [
      "-c:a",
      "libmp3lame",
      ...(bitrate
        ? ["-b:a", `${(bitrate / 1000).toFixed(0)}k`] // constant bitrate
        : ["-q:a", "2"]), // variable bitrate
    ];

    const { status, stderr } = spawnSync(
      "ffmpeg",
      ["-i", input, "-y", ...flags, output],
      {
        shell: true,
        encoding: "utf-8",
        cwd: Library.dir,
      }
    );

    if (status === 0) {
      Library.set(src, Library.parse(dest));
      await Library.remove(src);
    }

    if (status === -1) throw new Error(stderr);
  }
}
