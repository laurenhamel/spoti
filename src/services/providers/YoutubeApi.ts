import { Innertube, ClientType, Utils, UniversalCache } from "youtubei.js";
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
  TOptions extends SpotiOptions = SpotiOptions
>(
  data?: TData,
  options?: TOptions
) => TResponse;

class YoutubeApi {
  // @ts-ignore asynchronous initialization
  private api: Youtube.InnertubeApiInstance;

  // @ts-ignore asynchronous initialization
  private backup: Youtube.InnertubeApiInstance;

  constructor() {
    this.construct();
  }

  private construct() {
    this.validateCache();

    Innertube.create({
      cache: new UniversalCache(true, CACHE_API),
      generate_session_locally: true,
    }).then((api) => {
      this.api = api;
    });

    Innertube.create({
      client_type: ClientType.TV_EMBEDDED,
      cache: new UniversalCache(true, CACHE_BACKUP),
      generate_session_locally: true,
    }).then((api) => {
      this.backup = api;
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
    TOptions extends SpotiOptions = SpotiOptions
  >(data?: TData, options?: TOptions): Promise<TResponse> {
    !this.api && this.construct();

    const query = data?.query as string | undefined;

    if (!query) {
      throw new Error("Missing 'query' for Youtube Music song search.");
    }

    const response = await retry(
      () =>
        this.api.music.search(query, {
          type: "song",
        }),
      5,
      5000 // 5s
    );

    return (response.songs?.contents ?? []) as unknown[] as TResponse;
  }

  private async getSongInfo< TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions>(
    title: string,
    id: string,
    options?: TOptions
  ): Promise<{ info: VideoInfo; api: InnertubeApiInstance }> {
    let api = this.api;
    let info = await api.getInfo(id);

    const { playability_status: playability } = info;
    const { status } = playability ?? {};

    if (options?.verbose) {
      console.log(chalk.dim.bold('Playability'));
      console.log(title, `(${chalk.blue(id)})`, chalk.yellow(status), playability);
    }

    if (status === "LOGIN_REQUIRED") {
      api = this.backup;
      info = await api.getInfo(id, "TV_EMBEDDED");
    }

    return { info, api };
  }

  async downloadSong<
    TResponse extends Record<string, unknown> | unknown[] = Youtube.Download,
    TData extends Record<string, unknown> = {
      song: Youtube.Song;
      file: string;
    },
    TOptions extends SpotiOptions & { format?: AudioFormat } = SpotiOptions
  >(data?: TData, options?: TOptions): Promise<TResponse> {
    !this.api && this.construct();

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
      })()
    );

    const download = async (id: string): Promise<TResponse> => {
      const config: DownloadOptions = {
        type: "audio",
        quality: "best",
        format: "mp4",
      };

      if (options?.verbose) {
        console.log();
        console.log(chalk.bold.dim("Request"));
        console.log(chalk.magenta("GET"), chalk.cyan("<youtube>/getInfo"));
        console.log({ parameters: { id } });
      }

      const { info, api } = await this.getSongInfo(title, id, options);
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
          options
        )
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
        this.handleRetry("download", { title, song }, options)
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
    options?: TOptions
  ): RetryHandlers {
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
        const status = (error?: Error): string => {
          if (error) {
            const { stack } = error;
            const info = get(error, "info");
            const message = chalk.dim(info ? `${stack}\n${info}` : stack);

            switch (true) {
              case error instanceof SyntaxError:
                return chalk.red(`400 Bad Request\n${message}`);
              default:
                return chalk.red(`XXX Error\n${message}`);
            }
          }

          return chalk.green("200 OK");
        };

        if (options?.verbose) {
          console.log("");
          console.log(chalk.bold.dim("Response"));
          console.log(chalk.magenta.dim("GET"), chalk.cyan.dim(request));
          console.log(data);
          console.log(status(error));
        }
      },
    };
  }
}

export default new YoutubeApi();
