import {
  Innertube,
  ClientType,
  Utils,
  UniversalCache,
  SessionOptions,
  Platform,
  Types,
} from "youtubei.js";
import { Youtube } from "../../models";
import { AudioFormat, SpotiOptions } from "../../types";
import { Audio, getDownloadData, Library, RetryHandlers } from "../../utils";
import { Progress, retry } from "../../utils";
import chalk from "chalk";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { get, isNaN } from "lodash-es";
import { InnertubeApiInstance } from "../../models/youtube";
import { statSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { sync as glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_ROOT = resolve(__dirname, "../../../.youtube/cache");
const CACHE_API = join(CACHE_ROOT, "api");
const CACHE_BACKUP = join(CACHE_ROOT, "backup");

export type YoutubeApiRequestMethod = <
  TResponse extends Record<string, unknown> | unknown[] = any,
  TData extends Record<string, unknown> = any,
  TOptions extends SpotiOptions = SpotiOptions,
>(
  data?: TData,
  options?: TOptions,
) => TResponse;

class YoutubeApi {
  constructor() {
    this.construct();
  }

  private constructed: boolean = false;

  private construct() {
    this.validateCache();

    // Provide a JavaScript evaluator for Innertube
    Platform.shim.eval = async (
      data: Types.BuildScriptResult,
      env: Record<string, Types.VMPrimative>,
    ) => {
      const properties = [];
      if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
      // prettier-ignore
      if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
      const code = `${data.output}\nreturn { ${properties.join(", ")} }`;
      return new Function(code)();
    };

    this.constructed = true;
  }

  private api$: Youtube.InnertubeApiInstance | undefined;

  private async api(
    options?: SessionOptions,
  ): Promise<Youtube.InnertubeApiInstance> {
    return new Promise(async (resolve) => {
      if (!this.api$) {
        this.api$ = await Innertube.create({
          client_type: ClientType.WEB,
          cache: new UniversalCache(true, CACHE_API),
          generate_session_locally: true,
          ...options,
        });
      }

      resolve(this.api$);
    });
  }

  private backup$: Youtube.InnertubeApiInstance | undefined;

  private async backup(
    options?: SessionOptions,
  ): Promise<Youtube.InnertubeApiInstance> {
    return new Promise(async (resolve) => {
      if (!this.backup$) {
        this.backup$ = await Innertube.create({
          client_type: ClientType.TV_EMBEDDED,
          cache: new UniversalCache(true, CACHE_BACKUP),
          generate_session_locally: true,
          ...options,
        });
      }

      resolve(this.backup$);
    });
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
  >(data?: TData, options?: TOptions): Promise<TResponse> {
    if (!this.constructed) this.construct();

    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music song search.");
    }

    const api = await this.api();

    const response = await retry(
      () => api.music.search(query, { type: "song" }),
      5,
      5000, // 5s
    );

    return (response.songs?.contents ?? []) as unknown[] as TResponse;
  }

  private async getSongInfo<
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions,
  >(
    title: string,
    id: string,
    options?: TOptions,
  ): Promise<{
    info: VideoInfo;
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
        playability,
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

    const target = {
      input: AudioFormat.M4A,
      output: options?.format ?? Audio.DEFAULT_FORMAT,
    };

    const progress$ = new Progress(
      Progress.label(title),
      {
        type: "percentage",
        percentage: 0,
        nameTransformFn: chalk.yellow,
        message: chalk.dim(title),
      },
      (() => {
        let reports = 0;

        return (length: number, total?: number): void => {
          reports += length;

          if (total) {
            const downloaded = reports / total;
            !isNaN(download) && progress$?.update(downloaded, chalk.dim(title));
          }
        };
      })(),
    );

    const download = async (id: string): Promise<TResponse> => {
      if (options?.verbose) {
        console.log();
        console.log(chalk.bold.dim("Request"));
        console.log(chalk.magenta("GET"), chalk.cyan("<youtube>/getInfo"));
        console.log({ parameters: { id } });
      }

      const { info, api, client } = await this.getSongInfo(title, id, options);

      const config: DownloadOptions = {
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

      const stream = await retry(
        () => api.download(id, config),
        10,
        10000, // 10s
        this.handleRetry(
          "<youtube>/download",
          { parameters: { id, ...config } },
          options,
        ),
      );

      const file = Library.new(input.path);

      for await (const chunk of Utils.streamToIterable(stream)) {
        file.write(chunk);
        progress$.report(chunk.length, format.content_length);
      }

      await file.save();

      Library.set(input.file, Library.parse(input.file));

      return output as unknown as TResponse;
    };

    try {
      const result = await retry(
        () => download(song.id as string),
        5,
        5000, // 5s
        this.handleRetry("download", { title, song }, options),
      );
      return result;
    } catch (error) {
      throw error;
    } finally {
      progress$.done();
      progress$.remove();
    }
  }

  private handleRetry<TOptions extends SpotiOptions>(
    request: string,
    data?: unknown,
    options?: TOptions,
  ): RetryHandlers {
    const status = (error?: Error): { code: number; message: string } => {
      if (error) {
        const { stack } = error;
        const info = get(error, "info");
        const code = get(info, "response.status", -1);
        const message = chalk.dim(
          info ? `${stack}\n${JSON.stringify(info)}` : stack,
        );

        switch (true) {
          case error instanceof SyntaxError: {
            return {
              code: 400,
              message: chalk.red(`400 Bad Request\n${message}`),
            };
          }
          default:
            return { code, message: chalk.red(`${code} Error\n${message}`) };
        }
      }

      return { code: 200, message: chalk.green("200 OK") };
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
        const { code, message } = status(error);

        if (options?.verbose) {
          console.log("");
          console.log(chalk.bold.dim("Response"));
          console.log(chalk.magenta.dim("GET"), chalk.cyan.dim(request));
          console.log(data);
          console.log(message);
        }

        // Only continue if we haven't received a rejection code.
        return ![403].includes(code);
      },
    };
  }
}

export default new YoutubeApi();
