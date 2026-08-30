import { type Youtube } from "../models";
import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type SpotifyDownloadResult } from "../types/spotify";
import { type VideoFormat } from "../types/video";
import { Format } from "../utils/format";
import { pool } from "../utils/promise";
import { Library } from "./library";
import chalk from "chalk";
import { spawnSync } from "child_process";
import { trimStart } from "lodash-es";
import { extname } from "path";

export async function convertAudioFile<
  TOptions extends SpotiOptions & { format?: AudioFormat },
>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  const { file } = item.download;
  const existing = Library.find(file);
  const dest = existing?.raw.file ?? file;
  const src = Library.source(file);
  const bitrate = item.download.result?.bitrate;

  const padding = 75;

  const passed = (previous: string, next: string) => {
    console.log(
      chalk.green("✓"),
      chalk.dim(Format.truncateFile(previous, padding)),
      chalk.cyan("→"),
      chalk.green(Format.truncateFile(next, padding))
    );
  };

  const failed = (previous: string, next: string) => {
    console.log(
      chalk.red("𐄂"),
      chalk.dim(Format.truncateFile(previous, padding)),
      chalk.cyan("→"),
      chalk.red(Format.truncateFile(next, padding))
    );
  };

  const error = (previous: string, next: string) => {
    console.log(
      chalk.yellow("?"),
      chalk.dim(Format.truncateFile(previous, padding)),
      chalk.cyan("→"),
      chalk.yellow(Format.truncateFile(next, padding))
    );
  };

  if (Library.exists(dest)) {
    src && Library.exists(src) && Library.remove(src);
    passed(src, dest);
  } else if (Library.exists(src)) {
    try {
      await Audio.convert(Library.path(src), Library.path(dest), bitrate);
      passed(src, dest);
    } catch (_) {
      failed(src, dest);
    }
  } else {
    error(src, dest);
  }

  progress?.();
}

export async function transformAudioFiles<TOptions extends SpotiOptions>(
  items: SpotifyDownloadResult[],
  options?: TOptions,
  progress?: () => void
): Promise<void[]> {
  const dispatch = pool(25);

  const tasks: (() => Promise<void>)[] = items.map(
    (item) => () => convertAudioFile(item, options, progress)
  );

  console.log("");

  return dispatch(tasks);
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
