import { Youtube } from "../models";

export type YoutubeSearchResult = {
  query: string;
  result?: Youtube.Song;
};

export type YoutubeDownloadResult = Youtube.Download;
