import { type Youtube } from "../../models";
import { type AudioFormat } from "../../types/audio";
import { type SpotiOptions } from "../../types/config";
import { type RetryHandlers } from "../../types/promise";
import {
  type YoutubeDownloadMetadata,
  type YoutubeDownloadResult,
} from "../../types/youtube";
import { Audio } from "../../utils/audio";
import { isDebuggingEnabled } from "../../utils/console";
import {
  detectDownloadFormat,
  detectDownloadType,
  getDownloadPath,
} from "../../utils/downloads";
import { Library } from "../../utils/library";
import { Progress } from "../../utils/progress";
import { retry } from "../../utils/promise";
import {
  extractYoutubeFormats,
  getYoutubeMetadata,
  getYoutubeStream,
} from "../../utils/ytdlp";
import { PolicyAdapter } from "../adapters";
import chalk from "chalk";
import { sync as glob } from "glob";
import { get, merge } from "lodash-es";
import { statSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Innertube, { ClientType, UniversalCache, type Types } from "youtubei.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_ROOT = resolve(__dirname, "../../../.youtube/cache");
const CACHE_API = join(CACHE_ROOT, "api");
const CACHE_BACKUP = join(CACHE_ROOT, "backup");
const CACHE_AGE = 1000 * 60 * 60 * 24; // 24h

const YOUTUBE_RATE_LIMIT = {
  limit: 5,
  interval: 1000,
  strict: true,
};

const YOUTUBE_RETRIES = 5;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

const RETRYABLE_NETWORK_CODES = [
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
];

export type YoutubeApiRequestMethod = <
  TResponse extends Record<string, unknown> | unknown[] = Record<
    string,
    unknown
  >,
  TData extends Record<string, unknown> = Record<string, unknown>,
  TOptions extends SpotiOptions = SpotiOptions,
>(
  data?: TData,
  options?: TOptions
) => TResponse;

export interface YoutubeApiOptions {
  innertube?: Types.SessionOptions;
}

class YoutubeApi {
  options?: YoutubeApiOptions;

  // @ts-expect-error async initialization
  private api: Types.InnerTubeInstance;

  constructor(options?: YoutubeApiOptions) {
    this.options = options;
    void this.setup(options?.innertube);
  }

  /**
   * Sets up the Innertube handler with caching enabled
   */
  private async setup(options?: Types.SessionOptions) {
    const cache = this.cache();

    this.api = await Innertube.create(
      merge(
        {
          client_type: ClientType.WEB,
        },
        options,
        {
          fetch: this.fetch,
          cache,
          generate_session_locally: true,
        }
      )
    );
  }

  /**
   * Replaces the fetch method used by the Innertube handler
   */
  private fetch: typeof fetch = (input, init) => {
    return this.policy.police(() => fetch(input, init));
  };

  /**
   * Cleans up stale cache items and initializes the cache handler
   *
   * @remarks
   * If the cache is too far out of date, we may see requests start to fail.
   * For that reason, we invalidate the cache every so often, and start over.
   */
  private cache(age = CACHE_AGE): UniversalCache {
    const now = Date.now();
    const deadline = now - age;

    const clean = (path: string): void => {
      const files = glob(join(path, "*"), { nodir: true });
      const modified = files.map((file) => statSync(file).mtime.getTime());
      const oldest = Math.min(...modified);
      if (oldest <= deadline) files.forEach((file) => rmSync(file));
    };

    clean(CACHE_API);
    clean(CACHE_BACKUP);

    return new UniversalCache(true, CACHE_API);
  }

  /**
   * Creates an `fetch` request policy adapter
   */
  private readonly policy = new PolicyAdapter({
    rateLimit: YOUTUBE_RATE_LIMIT,
  });

  private updated = false;

  async searchSongs<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Song[],
    TData extends Record<string, unknown> = { query: string },
    TOptions extends SpotiOptions = SpotiOptions,
  >(data?: TData, _options?: TOptions): Promise<TResponse> {
    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music song search.");
    }

    const result = await retry(
      () => this.api.music.search(query, { type: "song" }),
      YOUTUBE_RETRIES,
      this.wait,
      this.retry("<youtube>/music/search", { parameters: { query } }, _options)
    );

    return (result.songs?.contents ?? []) as unknown[] as TResponse;
  }

  async searchVideos<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Song[],
    TData extends Record<string, unknown> = { query: string },
    TOptions extends SpotiOptions = SpotiOptions,
  >(data?: TData, _options?: TOptions): Promise<TResponse> {
    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music song search.");
    }

    const result = await retry(
      () => this.api.music.search(query, { type: "video" }),
      YOUTUBE_RETRIES,
      this.wait,
      this.retry("<youtube>/music/search", { parameters: { query } }, _options)
    );

    return (result.songs?.contents ?? []) as unknown[] as TResponse;
  }

  async getInfo<
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(song: Youtube.Song, _options?: TOptions): Promise<Types.TrackInfo> {
    if (isDebuggingEnabled("youtube")) {
      console.debug();
      console.debug(chalk.bold.dim("Request"));
      console.debug(chalk.magenta("GET"), chalk.cyan("<youtube>/getInfo"));
      console.debug({ parameters: { id: song.id } });
    }

    return this.api.music.getInfo(song);
  }

  async getMetadata<
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(
    title: string,
    song: Youtube.Song,
    options?: TOptions
  ): Promise<YoutubeDownloadMetadata> {
    const track = await this.getInfo(song);
    const url = track.basic_info.url_canonical!;
    const metadata = await getYoutubeMetadata(url, options);
    const formats = extractYoutubeFormats(metadata);
    const target = options?.format ?? Audio.DEFAULT_FORMAT;

    const inputs: Record<"audio" | "video", Youtube.Download> = {
      audio: getDownloadPath(title, metadata, formats.audio, undefined, true),
      video: getDownloadPath(title, metadata, formats.video, undefined, true),
    };

    const outputs: Record<"audio" | "video", Youtube.Download> = {
      audio: getDownloadPath(title, metadata, formats.audio, target),
      video: getDownloadPath(title, metadata, formats.video),
    };

    return { title, song, url, track, metadata, formats, inputs, outputs };
  }

  async downloadSong<
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(
    meta: YoutubeDownloadMetadata,
    options?: TOptions
  ): Promise<YoutubeDownloadResult> {
    const { title, url, inputs, outputs, formats, metadata } = meta;

    const progress = new Progress({
      label: title,
      total: 0,
      color: chalk.yellow.dim,
    });

    const stream = async (
      path: string,
      source: Youtube.Format,
      metadata: Youtube.Metadata
    ): Promise<void> => {
      const type = detectDownloadType(source);
      const format = detectDownloadFormat(source);

      // prettier-ignore
      const size = source.filesize ?? source.filesize_approx ?? metadata.filesize_approx;
      const target = await Library.new(path, size, format);

      let update: ((amount?: number) => void) | undefined;

      if (type === "audio") {
        progress.total = size;
        update = (amount = 1) => progress.update(amount);
      }

      try {
        const stream = getYoutubeStream(url, source, options);
        await target.write(stream, update);
      } catch (error) {
        await target.clean(true);
        throw error;
      }
    };

    const download = async (): Promise<YoutubeDownloadResult> => {
      const { duration, size } = inputs.audio;

      progress.total = size;

      // Skip if output file exists
      if (await Library.ready(outputs.audio.path, { duration, size })) {
        return { inputs, outputs };
      }

      // Skip if input file exists
      if (await Library.ready(inputs.audio.path, { duration, size })) {
        return { inputs, outputs };
      }

      await stream(inputs.audio.path, formats.audio, metadata);
      await stream(inputs.video.path, formats.video, metadata);

      return { inputs, outputs };
    };

    let error: Error | undefined;
    let result = {} as YoutubeDownloadResult;

    try {
      result = await retry(
        download,
        YOUTUBE_RETRIES,
        this.wait,
        this.retry("download", meta, options)
      );
    } catch (e) {
      error = e as Error;
    }

    progress.done();

    if (error) throw error;

    return result;
  }

  private wait(attempt: number): number {
    return Math.min(1000 * 2 ** (attempt - 1), 30000);
  }

  private retry<TOptions extends SpotiOptions>(
    request: string,
    data?: unknown,
    _options?: TOptions
  ): RetryHandlers {
    const status = (
      error?: Error
    ): { code: number; message: string; retryable: boolean } => {
      if (error) {
        const { stack } = error;
        const info = get(error, "info");
        const code = get(info, "response.status", -1);
        // prettier-ignore
        const cause = get(error, "cause.code", get(error, "code")) as string | undefined;
        const type = get(info, "error_type");

        const message = chalk.dim(
          info ? `${stack}\n${JSON.stringify(info)}` : stack
        );

        switch (true) {
          case error instanceof SyntaxError: {
            return {
              code: 400,
              message: chalk.red(`400 Bad Request\n${message}`),
              retryable: false,
            };
          }
          default:
            return {
              code,
              message: chalk.red(`${code} Error\n${message}`),
              retryable:
                RETRYABLE_STATUS_CODES.includes(code) ||
                RETRYABLE_NETWORK_CODES.includes(cause ?? "") ||
                type === "FETCH_FAILED",
            };
        }
      }

      return { code: 200, message: chalk.green("200 OK"), retryable: false };
    };

    return {
      before: () => {
        if (isDebuggingEnabled("youtube")) {
          console.debug("");
          console.debug(chalk.bold.dim("Request"));
          console.debug(chalk.magenta("GET"), chalk.cyan(request));
          console.debug(data);
        }
      },
      after: ({ error }) => {
        const { message, retryable } = status(error);

        if (isDebuggingEnabled("youtube")) {
          console.debug("");
          console.debug(chalk.bold.dim("Response"));
          console.debug(chalk.magenta.dim("GET"), chalk.cyan.dim(request));
          console.debug(data);
          console.debug(message);
        }

        return retryable;
      },
    };
  }
}

export default new YoutubeApi();
