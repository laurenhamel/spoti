import { type Youtube } from "../models";
import { type SpotiOptions } from "../types/config";
import { getYtdlpBin, ensureYtdlpLatest } from "./dependencies";
import { detectDownloadType } from "./downloads";
import { createProcessExitAbort } from "./process";
import { execa } from "execa";
import { type Readable } from "node:stream";

// prettier-ignore
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function getYoutubeMetadata<TOptions extends SpotiOptions>(
  id: string,
  options?: TOptions
): Promise<Youtube.Metadata> {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();

  const args = [
    ...(options?.verbose ? ["--verbose"] : ["--no-warnings"]),
    "--dump-json",
    `ytsearch:${id}`,
  ];

  const { stdout } = await execa(ytdlp, args, {
    cleanup: true,
    cancelSignal: abort.signal,
    maxBuffer: 100 * 1024 * 1024, // 100 MB
  });

  return JSON.parse(stdout.trim());
}

export function getYoutubeStream<TOptions extends SpotiOptions>(
  url: string,
  format: Youtube.Format,
  options?: TOptions
): Readable {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();
  const id = format.format_id;
  const type = detectDownloadType(format);
  const best = type === "video" ? "bestvideo[ext=mp4]" : "bestaudio";

  const args = [
    ...(options?.verbose ? ["--verbose"] : ["--no-warnings"]),
    "--ignore-errors",
    "--no-playlist",
    "--user-agent",
    USER_AGENT,
    "--extractor-args",
    "youtube:player-client=ios,mweb,android,web",
    "--format",
    `${id}/${best}/best`,
    "--sleep-interval",
    "5",
    "--max-sleep-interval",
    "15",
    "--sleep-requests",
    "1.5",
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--retry-sleep",
    "fragment:exp=1:20",
    "--output",
    "-",
    ...(type === "video" ? ["--remux-video", "mkv"] : ["-x"]),
    url,
  ];

  const { stdout } = execa(ytdlp, args, {
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
