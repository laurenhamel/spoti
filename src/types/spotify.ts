import { type Spotify, type Youtube } from "../models";
import { type SpotiOptions } from "./config";
import {
  type YoutubeDownloadResult,
  type YoutubeSearchResult,
} from "./youtube";
import { type SetRequiredDeep } from "type-fest";

export type SpotifyMetadataResult = {
  type: Spotify.Type;
  id: string;
};

export type SpotifySearchResult = Spotify.Item & {
  search: YoutubeSearchResult;
};

export type SpotifyDownloadTarget = SpotifySearchResult & {
  download: Youtube.DownloadPath & {
    title: string;
    inputs?: Record<"audio" | "video", Youtube.DownloadPath>;
    outputs?: Record<"audio" | "video", Youtube.DownloadPath>;
    result?: YoutubeDownloadResult;
  };
};

export type SpotifyDownloadPreparer<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options?: TOptions
) => SpotifyDownloadTarget[];

export type SpotifyStatus = "passed" | "skipped" | "failed";

export type SpotifyDownloadResult =
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };

export type SpotifyConversionResult =
  | {
      source: SpotifyDownloadResult;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      source: SpotifyDownloadResult;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      source: SpotifyDownloadResult;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };

export type SpotifyTaggingResult<
  TSource extends SpotifyDownloadTarget | SpotifyDownloadResult,
> =
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };
