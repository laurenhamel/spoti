import { Youtube } from "../models";
import { extname } from "path";
import { rmSync } from "node:fs";
import { spawnSync } from "child_process";
import { Library } from "./library";
import { trimStart } from "lodash-es";

export function detectAudioFormat(file: string): Youtube.AudioFormat {
  return trimStart(extname(file), ".") as Youtube.AudioFormat;
}

export async function convertToMp3(
  src: string,
  dest: string
): Promise<Youtube.DownloadOf<Youtube.AudioFormat.MP3>> {
  return new Promise((resolve, reject) => {
    const { status, stderr } = spawnSync(
      "ffmpeg",
      ["-y", "-i", `"${src}"`, "-vn", `"${dest}"`],
      {
        shell: true,
        encoding: "utf-8",
      }
    );

    if (status === 0) {
      Library.exists(src) && rmSync(src);
    }

    return status === -1
      ? reject(stderr)
      : resolve({
          title: Library.title(dest),
          path: Library.file(dest),
          format: Youtube.AudioFormat.MP3,
        });
  });
}
