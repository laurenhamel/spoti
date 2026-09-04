import { type Spotify } from "../models";
import { type AudioFormat } from "./audio";
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
  download: {
    title: string;
    file: string;
    path: string;
    format: AudioFormat;
    result?: YoutubeDownloadResult;
  };
};

export type SpotifyDownloadResult =
  | {
      item: SetRequiredDeep<SpotifyDownloadTarget, "download.result">;
      status: "passed";
    }
  | {
      item: SetRequiredDeep<SpotifyDownloadTarget, "download.result">;
      status: "skipped";
    }
  | {
      item: SetRequiredDeep<SpotifyDownloadTarget, "download.result">;
      status: "failed";
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
