import { type Youtube } from "../models";
import { type SpotiOptions } from "../types/config";
import { isDebuggingEnabled } from "./console";
import { getYtdlpBin, ensureYtdlpLatest } from "./dependencies";
import { createProcessExitAbort } from "./process";
import chalk from "chalk";
import defaultBrowser from "default-browser";
import { execa } from "execa";
import { compact } from "lodash-es";
import { type Readable } from "node:stream";

// prettier-ignore
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CLIENTS = ["ios", "tv_embedded", "android", "mweb", "web"] as const;
const SLEEP_INTERVAL = 5;
const MAX_SLEEP_INTERVAL = 15;
const SLEEP_REQUESTS = 1.5;
const RETRIES = 10;
const FRAGMENT_RETRIES = 10;
const FRAGMENT_SLEEP_INTERVAL = 1;
const FRAGMENT_MAX_SLEEP_INTERVAL = 20;

export async function getYoutubeMetadata<TOptions extends SpotiOptions>(
  id: string,
  options?: TOptions
): Promise<Youtube.Metadata> {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();
  const browser = (await defaultBrowser()).name.toLowerCase();

  const args = [
    ...(isDebuggingEnabled("youtube", "ytdlp")
      ? ["--verbose"]
      : ["--no-warnings"]),
    "--ignore-no-formats-error",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "--user-agent",
    USER_AGENT,
    "--cookies-from-browser",
    browser,
    "--extractor-args",
    `youtube:player-client=${CLIENTS.join(",")}`,
    "--dump-json",
    "--",
    `https://www.youtube.com/watch?v=${id}`,
  ];

  const { stdout } = await execa(ytdlp, args, {
    cleanup: true,
    cancelSignal: abort.signal,
    maxBuffer: 100 * 1024 * 1024, // 100 MB
  });

  return JSON.parse(stdout.trim());
}

export async function getYoutubeStream<
  TOptions extends SpotiOptions & { output?: "audio" | "video" }, // @TODO Add configuration for 'audio' vs. 'video' output preference
>(
  url: string,
  options?: TOptions
): Promise<{
  stream: Readable;
  done: Promise<void>;
}> {
  const ytdlp = getYtdlpBin();

  ensureYtdlpLatest(options);

  const abort = createProcessExitAbort();
  const type = options?.output ?? "audio";
  const format = "bestvideo+bestaudio/best";
  const browser = (await defaultBrowser()).name.toLowerCase();

  const args = [
    ...(isDebuggingEnabled("youtube", "ytdlp")
      ? ["--verbose"]
      : ["--no-warnings"]),
    "--no-playlist",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    "--user-agent",
    USER_AGENT,
    "--cookies-from-browser",
    browser,
    "--extractor-args",
    `youtube:player-client=${CLIENTS.join(",")}`,
    "--format",
    format,
    "--sleep-interval",
    SLEEP_INTERVAL.toString(),
    "--max-sleep-interval",
    MAX_SLEEP_INTERVAL.toString(),
    "--sleep-requests",
    SLEEP_REQUESTS.toString(),
    "--retries",
    RETRIES.toString(),
    "--fragment-retries",
    FRAGMENT_RETRIES.toString(),
    "--retry-sleep",
    `fragment:exp=${FRAGMENT_SLEEP_INTERVAL}:${FRAGMENT_MAX_SLEEP_INTERVAL}`,
    "--output",
    "-",
    "--",
    url,
  ];

  const download = execa(ytdlp, args, {
    encoding: "buffer" as const,
    buffer: false,
    cleanup: true,
    cancelSignal: abort.signal,
    reject: false,
  });

  let stderr: string | undefined;

  download.stderr.on("data", (chunk) => {
    stderr = stderr ?? "";
    stderr += chunk.toString();
  });

  return {
    stream: download.stdout,
    done: (async () => {
      const { failed, exitCode } = await download;

      if (failed) {
        const error = new Error(
          compact([
            `Download failed for '${url}'.`,
            `Exited with code ${exitCode}.`,
            chalk.dim("  Type:", type),
            chalk.dim("  Clients:", CLIENTS.join(", ")),
            // chalk.dim("  Format:", format.split("/").join(", ")),
            stderr?.trim(),
          ]).join("\n")
        );

        throw error;
      }
    })(),
  };
}
