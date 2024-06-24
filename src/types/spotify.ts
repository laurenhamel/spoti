import { Spotify } from "../models";
import { AudioFormat } from "./audio";
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
  features?: Spotify.Features;
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

export type SpotifyTagResult = SpotifyDownloadResult & {
  tags: Tags;
};
