import { type Spotify } from "../models";
import { type AudioFormat } from "./audio";
import { type SpotiOptions } from "./config";
import {
  type YoutubeDownloadResult,
  type YoutubeSearchResult,
} from "./youtube";
import { type Tags } from "node-id3";

export type SpotifyMetadataResult = {
  type: Spotify.Type;
  id: string;
};

export type SpotifySearchResult = Spotify.Item & {
  search: YoutubeSearchResult;
};

export type SpotifyDownloadResult = SpotifySearchResult & {
  download: {
    title: string;
    file: string;
    path: string;
    format: AudioFormat;
    result?: YoutubeDownloadResult;
  };
};

export type SpotifyDownloadPreparer<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options?: TOptions
) => SpotifyDownloadResult[];

export type SpotifyTagResult = SpotifyDownloadResult & {
  tags: Tags;
};
