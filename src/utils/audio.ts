import { type Youtube } from "../models";
import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type SpotifyDownloadResult } from "../types/spotify";
import { type VideoFormat } from "../types/video";
import { Format } from "../utils/format";
import { pool } from "../utils/promise";
import { Library } from "./library";
import { Progress } from "./progress";
import chalk from "chalk";
import { spawnSync } from "child_process";
import { trimStart } from "lodash-es";
import { extname } from "path";

export async function convertAudioFile<
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(
  result: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<boolean> {
  // Ignore failed and/or skipped downloads
  if (["failed", "skipped"].includes(result.status)) {
    progress?.();
    return false;
  }

  const { item } = result;
  const { file } = result.item.download;
  const existing = Library.find(file);
  const dest = existing?.raw.file ?? file;
  const src = Library.source(file);
  const bitrate = item.download.result?.bitrate;
  const length = 75;

  const diff = (previous: string, next: string): string => {
    const from = chalk.dim(Format.truncateFile(previous, length));
    const to = chalk.green(Format.truncateFile(next, length));
    return [from, "→", to].join(" ");
  };

  // Final audio file exists
  if (Library.exists(dest)) {
    // Removes source file if it exists
    src && Library.exists(src) && Library.remove(src);
    console.log(chalk.green("✓"), diff(src, dest));
    progress?.();
    return true;
  }

  // Source file exists
  if (Library.exists(src)) {
    try {
      await Audio.convert(Library.path(src), Library.path(dest), bitrate);
      console.log(chalk.green("✓"), diff(src, dest));
      return true;
    } catch (_) {
      console.log(chalk.red("𐄂"), diff(src, dest));
      return false;
    } finally {
      progress?.();
    }
  }

  // No source file and no final audio –– we should never end up here!
  console.log(chalk.yellow("?"), diff(src, dest));
  progress?.();
  return false;
}

export async function convertAudioFiles<TOptions extends SpotiOptions>(
  results: SpotifyDownloadResult[],
  options?: TOptions
): Promise<boolean[]> {
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
  const statuses = await dispatch(tasks);
  progress.done();

  return statuses;
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
  ): Promise<Youtube.DownloadOf<AudioFormat>> {
    const input = '"' + Library.file(src).replace(/"/g, '\\"') + '"';
    const output = '"' + Library.file(dest).replace(/"/g, '\\"') + '"';
    const format = this.format<AudioFormat>(dest);

    const flags: Record<AudioFormat, string[]> = {
      [AudioFormat.MP3]: [
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        ...(bitrate ? ["-b:a", `${(bitrate / 1000).toFixed(0)}k`] : []),
      ],
      [AudioFormat.M4A]: [],
      [AudioFormat.AAC]: ["-c:a", "aac_at"],
      [AudioFormat.WAV]: [],
    };

    const { status, stderr } = spawnSync(
      "ffmpeg",
      ["-i", input, "-y", ...flags[format], output],
      {
        shell: true,
        encoding: "utf-8",
        cwd: Library.dir,
      }
    );

    if (status === 0) {
      Library.set(src, Library.parse(dest));
      Library.remove(src);
    }

    if (status === -1) throw new Error(stderr);

    return {
      file: Library.file(dest),
      path: Library.path(dest),
      format,
    };
  }
}
