import { type Youtube } from "../../models";
import { type InnertubeApiInstance } from "../../models/youtube";
import { AudioFormat } from "../../types/audio";
import { type SpotiOptions } from "../../types/config";
import { type RetryHandlers } from "../../types/promise";
import { Audio } from "../../utils/audio";
import { getDownloadData } from "../../utils/downloads";
import { Library } from "../../utils/library";
import { Progress } from "../../utils/progress";
import { retry } from "../../utils/promise";
import { PolicyAdapter } from "../adapters";
import chalk from "chalk";
import { sync as glob } from "glob";
import { filter, flatMap, get } from "lodash-es";
import { statSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Innertube,
  ClientType,
  Utils,
  UniversalCache,
  type SessionOptions,
  Platform,
  type Types,
} from "youtubei.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_ROOT = resolve(__dirname, "../../../.youtube/cache");
const CACHE_API = join(CACHE_ROOT, "api");
const CACHE_BACKUP = join(CACHE_ROOT, "backup");

const YOUTUBE_RATE_LIMIT = {
  limit: 5,
  interval: 1000,
  strict: true,
};

const YOUTUBE_RETRIES = 5;

const youtubeRetryDelay = (attempt: number): number =>
  Math.min(1000 * 2 ** (attempt - 1), 30000);

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

class YoutubeApi {
  constructor() {
    this.construct();
  }

  private readonly policy = new PolicyAdapter({
    rateLimit: YOUTUBE_RATE_LIMIT,
  });

  private readonly fetch: typeof fetch = (input, init) =>
    this.policy.police(() => fetch(input, init));

  private constructed: boolean = false;

  private construct() {
    this.validateCache();

    // Provide a JavaScript evaluator for Innertube
    Platform.shim.eval = async (
      data: Types.BuildScriptResult,
      env: Record<string, Types.VMPrimative>
    ) => {
      const properties = [];
      if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
      if (env.sig)
        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
      const code = `${data.output}\nreturn { ${properties.join(", ")} }`;
      return new Function(code)();
    };

    this.constructed = true;
  }

  private api$: Youtube.InnertubeApiInstance | undefined;

  private async api(
    options?: SessionOptions
  ): Promise<Youtube.InnertubeApiInstance> {
    if (!this.api$) {
      this.api$ = await Innertube.create({
        client_type: ClientType.WEB,
        cache: new UniversalCache(true, CACHE_API),
        generate_session_locally: true,
        ...options,
        fetch: this.fetch,
      });
    }

    return this.api$;
  }

  private backup$: Youtube.InnertubeApiInstance | undefined;

  private async backup(
    options?: SessionOptions
  ): Promise<Youtube.InnertubeApiInstance> {
    if (!this.backup$) {
      this.backup$ = await Innertube.create({
        client_type: ClientType.TV_EMBEDDED,
        cache: new UniversalCache(true, CACHE_BACKUP),
        generate_session_locally: true,
        ...options,
        fetch: this.fetch,
      });
    }

    return this.backup$;
  }

  /**
   * If the cache is too far out of date, we may see request start to fail.
   * For that reason, invalidate the cache every so often, and start over.
   */
  private validateCache(session = 1000 * 60 * 60 * 24 /* 24h */): void {
    const now = Date.now();
    const deadline = now - session;

    const validate = (path: string): void => {
      const files = glob(join(path, "*"), { nodir: true });
      const modified = files.map((file) => statSync(file).mtime.getTime());
      const oldest = Math.min(...modified);

      if (oldest <= deadline) {
        files.forEach((file) => rmSync(file));
      }
    };

    validate(CACHE_API);
    validate(CACHE_BACKUP);
  }

  async searchSongs<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Song[],
    TData extends Record<string, unknown> = { query: string },
    TOptions extends SpotiOptions = SpotiOptions,
  >(data?: TData, _options?: TOptions): Promise<TResponse> {
    if (!this.constructed) this.construct();

    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music song search.");
    }

    const api = await this.api();

    const result = await retry(
      () => api.music.search(query, { type: "song" }),
      YOUTUBE_RETRIES,
      youtubeRetryDelay,
      this.handleRetry(
        "<youtube>/music/search",
        { parameters: { query } },
        _options
      )
    );

    return (result.songs?.contents ?? []) as unknown[] as TResponse;
  }

  async searchVideos<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Song[],
    TData extends Record<string, unknown> = { query: string },
    TOptions extends SpotiOptions = SpotiOptions,
  >(data?: TData, _options?: TOptions): Promise<TResponse> {
    if (!this.constructed) this.construct();

    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music video search.");
    }

    const api = await this.api();

    const result = await retry(
      () => api.music.search(query, { type: "video" }),
      YOUTUBE_RETRIES,
      youtubeRetryDelay,
      this.handleRetry(
        "<youtube>/music/search",
        { parameters: { query } },
        _options
      )
    );

    return flatMap(
      filter(result.contents ?? [], { type: "MusicShelf" }),
      "contents"
    ) as unknown[] as TResponse;
  }

  private async getSongInfo<
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(
    title: string,
    id: string,
    options?: TOptions
  ): Promise<{
    info: Awaited<ReturnType<InstanceType<typeof Innertube>["getInfo"]>>;
    api: InnertubeApiInstance;
    client: "WEB" | "TV_EMBEDDED";
  }> {
    let api = await this.api();
    let client: "WEB" | "TV_EMBEDDED" = "WEB";
    let info = await api.getInfo(id);

    const { playability_status: playability } = info;
    const { status } = playability ?? {};

    if (options?.verbose) {
      console.log(chalk.dim.bold("Playability"));
      console.log(
        title,
        `(${chalk.blue(id)})`,
        chalk.yellow(status),
        playability
      );
    }

    if (status === "LOGIN_REQUIRED") {
      api = await this.backup();
      client = "TV_EMBEDDED";
      info = await api.getInfo(id, { client: "TV_EMBEDDED" });
    }

    return { info, api, client };
  }

  async downloadSong<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Download,
    TData extends Record<string, unknown> = {
      song: Youtube.Song;
      file: string;
    },
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(data?: TData, options?: TOptions): Promise<TResponse> {
    if (!this.constructed) this.construct();

    const title = data?.title as string | undefined;
    const song = data?.song as Youtube.Song | undefined;

    if (!title) throw new Error("Missing 'title' to use for download.");
    if (!song) throw new Error("Missing 'song' to download.");

    const target: {
      input: AudioFormat;
      output: AudioFormat;
    } = {
      input: AudioFormat.M4A,
      output: options?.format ?? Audio.DEFAULT_FORMAT,
    };

    const progress = new Progress({
      label: title,
      total: 0,
      color: chalk.yellow.dim,
    });

    const download = async (id: string): Promise<TResponse> => {
      if (options?.verbose) {
        console.log();
        console.log(chalk.bold.dim("Request"));
        console.log(chalk.magenta("GET"), chalk.cyan("<youtube>/getInfo"));
        console.log({ parameters: { id } });
      }

      const { info, api, client } = await this.getSongInfo(title, id, options);

      const config: Types.DownloadOptions = {
        type: "video+audio",
        quality: "best",
        format: "mp4",
        client,
      };

      const format = info.chooseFormat(config);
      const duration = info.basic_info.duration;

      const data = getDownloadData(title, format.bitrate);
      const input = data[target.input];
      const output = data[target.output];

      if (await Library.ready(input.path, { duration })) {
        return output as unknown as TResponse;
      }

      const stream = await api.download(id, config);

      const file = Library.new(input.path);

      for await (const chunk of Utils.streamToIterable(stream)) {
        file.write(chunk);
        progress.total = format.content_length ?? chunk.length;
        progress.update(chunk.length);
      }

      await file.save();

      Library.set(input.file, Library.parse(input.file));

      return output as unknown as TResponse;
    };

    let error: Error | undefined;
    let result: TResponse = {} as TResponse;

    try {
      result = await retry(
        () => download(song.id as string),
        YOUTUBE_RETRIES,
        youtubeRetryDelay,
        this.handleRetry("download", { title, song }, options)
      );
    } catch (e) {
      error = e as Error;
    }

    progress.done();

    if (error) throw error;

    return result;
  }

  private handleRetry<TOptions extends SpotiOptions>(
    request: string,
    data?: unknown,
    options?: TOptions
  ): RetryHandlers {
    const status = (
      error?: Error
    ): { code: number; message: string; retryable: boolean } => {
      if (error) {
        const { stack } = error;
        const info = get(error, "info");
        const code = get(info, "response.status", -1);
        const networkCode = get(error, "cause.code", get(error, "code")) as
          string | undefined;
        const errorType = get(info, "error_type");
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
                RETRYABLE_NETWORK_CODES.includes(networkCode ?? "") ||
                errorType === "FETCH_FAILED",
            };
        }
      }

      return { code: 200, message: chalk.green("200 OK"), retryable: false };
    };

    return {
      before: () => {
        if (options?.verbose) {
          console.log("");
          console.log(chalk.bold.dim("Request"));
          console.log(chalk.magenta("GET"), chalk.cyan(request));
          console.log(data);
        }
      },
      after: ({ error }) => {
        const { message, retryable } = status(error);

        if (options?.verbose) {
          console.log("");
          console.log(chalk.bold.dim("Response"));
          console.log(chalk.magenta.dim("GET"), chalk.cyan.dim(request));
          console.log(data);
          console.log(message);
        }

        return retryable;
      },
    };
  }
}

export default new YoutubeApi();
