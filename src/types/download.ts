import type { Spotify, Youtube } from "../models";
import type { SpotiOptions } from "./configuration";
import type { SearchResult, SearchResultItem } from "./search";
import type { SpotifyStatus } from "./spotify";
import type { SetRequiredDeep } from "type-fest";

export type DownloadTarget = SearchResultItem & {
  download: Youtube.DownloadPath & {
    title: string;
    input?: Youtube.DownloadPath;
    output?: Youtube.DownloadPath;
    result?: DownloadResult;
  };
};

export type DownloadPreparerOf<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  results: SearchResult[],
  options?: TOptions
) => DownloadTarget[];

export type DownloadResult =
  | {
      item: SetRequiredDeep<
        DownloadTarget,
        "download.input" | "download.output"
      >;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      item: SetRequiredDeep<
        DownloadTarget,
        "download.input" | "download.output"
      >;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      item: SetRequiredDeep<
        DownloadTarget,
        "download.input" | "download.output"
      >;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };
