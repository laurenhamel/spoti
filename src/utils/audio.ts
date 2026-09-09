import { type Youtube } from "../models";
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
import { renameSync } from "node:fs";
import { basename } from "node:path";
import { extname } from "path";

export async function convertAudioFile<
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(
  source: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<SpotifyConversionResult> {
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
  const input = download.input!;
  const output = download.output!;
  const length = 75;

  const diff = (
    input: Youtube.DownloadPath,
    output: Youtube.DownloadPath
  ): string => {
    const src = basename(input.path);
    const dest = basename(output.path);
    const from = chalk.dim(Format.truncateFile(src, length));
    const to = chalk.green(Format.truncateFile(dest, length));
    return [from, "→", to].join(" ");
  };

  // Output exists
  if (Library.exists(output.path)) {
    // Delete input
    if (Library.exists(input.path)) Library.remove(input.path);
    console.log(scope, chalk.green("✓"), title);
    options?.verbose &&
      console.log(scope, chalk.green("✓"), diff(input, output));
    progress?.();
    return { source, status: "passed" };
  }

  // Input exists
  if (Library.exists(input.path)) {
    try {
      await Audio.convert(input.path, output.path, options);
      console.log(scope, chalk.green("✓"), title);
      options?.verbose &&
        console.log(scope, chalk.green("✓"), diff(input, output));
      return { source, status: "passed" };
    } catch (e) {
      const error = e as Error;
      console.log(scope, chalk.red("𐄂"), title);
      options?.verbose &&
        console.log(scope, chalk.red("𐄂"), diff(input, output));
      return { source, status: "failed", error };
    } finally {
      progress?.();
    }
  }

  // No input or output exists –– we should never end up here!
  console.log(scope, chalk.yellow("?"), title);
  options?.verbose && console.log(chalk.yellow("?"), diff(input, output));
  const src = basename(input.path);
  const dest = basename(output.path);
  const error = new Error(`Audio conversion failed for '${dest}' ('${src}').`);
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
  static async convert<
    TOptions extends SpotiOptions & { output?: "audio" | "video" }, // @TODO Add configuration for 'audio' vs. 'video' output preference
  >(src: string, dest: string, options?: TOptions): Promise<void> {
    if (extname(src) === extname(dest) && basename(src) !== basename(dest)) {
      renameSync(src, dest);
      Library.set(dest, Library.parse(dest));
      Library.remove(src);
      return;
    }

    const type = options?.output ?? "audio";
    const codec = type === "video" ? "v" : "a";
    const input = '"' + Library.file(src).replace(/"/g, '\\"') + '"';
    const output = '"' + Library.file(dest).replace(/"/g, '\\"') + '"';

    const args = [
      "-i",
      input,
      "-y",
      ...(type === "audio" ? ["-vn"] : []),
      `-c:${codec}`,
      "libmp3lame",
      "-q:a",
      "0",
      output,
    ];

    const { status, stderr } = spawnSync("ffmpeg", args, {
      shell: true,
      encoding: "utf-8",
      cwd: Library.dir,
    });

    if (status === 0) {
      Library.set(dest, Library.parse(dest));
      Library.remove(src);
    }

    if (status === -1) throw new Error(stderr);
  }
}
