import { type Youtube } from "../models";
import { type SpotiOptions } from "../types/config";
import { type YtdlpOptions } from "../types/ytdlp";
import { getYtdlpBin, ensureYtdlpLatest } from "./dependencies";
import { detectDownloadType } from "./downloads";
import { convertArgs, createProcessExitAbort } from "./process";
import { execa } from "execa";
import { merge } from "lodash-es";
import { type Readable } from "node:stream";

export async function getYoutubeMetadata<TOptions extends SpotiOptions>(
  id: string,
  options?: TOptions,
  overrides: YtdlpOptions = {}
): Promise<Youtube.Metadata> {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();

  const args = convertArgs(
    merge(
      {
        noWarnings: true,
      },
      overrides,
      {
        dumpJson: true,
      }
    )
  );

  const { stdout } = await execa(ytdlp, [...args, `ytsearch:${id}`], {
    cleanup: true,
    cancelSignal: abort.signal,
  });

  return JSON.parse(stdout.trim());
}

export function getYoutubeStream<TOptions extends SpotiOptions>(
  url: string,
  format: Youtube.Format,
  options?: TOptions,
  overrides: YtdlpOptions = {}
): Readable {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();

  const type = detectDownloadType(format);
  const best = type === "video" ? "bestvideo" : "bestaudio";

  const args = convertArgs(
    merge(
      {
        noPlaylist: true,
        noWarnings: true,
      },
      overrides,
      {
        format: `${format.format_id}/${best}`,
        output: "-",
      }
    )
  );

  const { stdout } = execa(ytdlp, [...args, url], {
    encoding: "buffer",
    buffer: false,
    cleanup: true,
    cancelSignal: abort.signal,
  });

  return stdout;
}

export function extractYoutubeFormats(
  metadata: Youtube.Metadata
): Record<"audio" | "video", Youtube.Format> {
  const ids = metadata.format_id.split("+");

  return metadata.formats
    .filter(({ format_id }) => ids.includes(format_id))
    .reduce(
      (result, format) => ({ ...result, [detectDownloadType(format)]: format }),
      {} as Record<"audio" | "video", Youtube.Format>
    );
}
