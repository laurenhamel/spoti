import { Youtube } from "../models";
import { AudioFormat, VideoFormat } from "../types";
import { extname } from "path";
import { spawnSync } from "child_process";
import { Library } from "./library";
import { trimStart } from "lodash-es";

export class Audio {
  static readonly DEFAULT_FORMAT: AudioFormat = AudioFormat.MP3;

  /**
   * Detect that audio/video file format
   * @param file - The file to retrieve the format of
   * @returns
   */
  static format<
    TFormat extends AudioFormat | VideoFormat = AudioFormat | VideoFormat
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
    return new Promise((resolve, reject) => {
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

      return status === -1
        ? reject(stderr)
        : resolve({
            file: Library.file(dest),
            path: Library.path(dest),
            format,
          });
    });
  }
}
