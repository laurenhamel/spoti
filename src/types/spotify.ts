import { type Spotify, type Youtube } from "../models";
import { type SpotiOptions } from "./config";
import {
  type YoutubeDownloadResult,
  type YoutubeSearchResult,
} from "./youtube";
import { type Tags } from "node-id3";
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

export type SpotifyDownloadStatus = "passed" | "skipped" | "failed";

export type SpotifyDownloadResult =
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyDownloadStatus, "passed">;
    }
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyDownloadStatus, "skipped">;
    }
  | {
      item: SetRequiredDeep<
        SpotifyDownloadTarget,
        "download.inputs" | "download.outputs"
      >;
      status: Extract<SpotifyDownloadStatus, "failed">;
      error: Error;
    };

export type SpotifyDownloadPreparer<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options?: TOptions
) => SpotifyDownloadTarget[];

export type SpotifyTagResult = SpotifyDownloadTarget & {
  tags: Tags;
};
