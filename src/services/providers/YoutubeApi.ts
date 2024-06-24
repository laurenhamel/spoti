import { Innertube, ClientType, Utils, UniversalCache } from "youtubei.js";
import { Youtube } from "../../models";
import { AudioFormat, SpotiOptions } from "../../types";
import { Audio, getDownloadData, Library } from "../../utils";
import { Progress, retry } from "../../utils";
import chalk from "chalk";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { isNaN } from "lodash-es";
import { InnertubeApiInstance } from "../../models/youtube";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE = resolve(__dirname, "../../../.youtube/cache");

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
    Innertube.create({
      cache: new UniversalCache(true, join(CACHE, "api")),
      generate_session_locally: true,
    }).then((api) => {
      this.api = api;
    });

    Innertube.create({
      client_type: ClientType.TV_EMBEDDED,
      cache: new UniversalCache(true, join(CACHE, "backup")),
      generate_session_locally: true,
    }).then((api) => {
      this.backup = api;
    });
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

  private async getSongInfo(
    id: string
  ): Promise<{ info: VideoInfo; api: InnertubeApiInstance }> {
    let api = this.api;
    let info = await api.getInfo(id);

    const { status } = info.playability_status;

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

      const { info, api } = await this.getSongInfo(id);
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
        10000 // 10s
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
        5000 // 5s
      );
      return result;
    } catch (error) {
      throw error;
    } finally {
      progress$.done();
      progress$.remove();
    }
  }
}

export default new YoutubeApi();
