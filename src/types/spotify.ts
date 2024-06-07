import { Spotify } from "../models";
import {
  type YoutubeDownloadResult,
  type YoutubeSearchResult,
} from "./youtube";

export type SpotifySearchResult = Spotify.Item & {
  search: YoutubeSearchResult;
  features?: Spotify.Features;
};

export type SpotifyDownloadResult = SpotifySearchResult & {
  download: {
    artist: string;
    song: string;
    title: string;
    path: string;
    result?: YoutubeDownloadResult;
  };
};
