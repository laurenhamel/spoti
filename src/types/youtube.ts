import { type Youtube, type Spotify } from "../models";

export type YoutubeSearchResult = {
  track: Spotify.Track;
  query: string;
  result?: Youtube.Song;
};

export type YoutubeDownloadResult = Youtube.Download;
