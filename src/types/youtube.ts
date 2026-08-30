import { type Youtube, type Spotify } from "../models";
import { type SpotiOptions } from "./config";

export type YoutubeSearchResult = {
  track: Spotify.Track;
  query: string;
  result?: Youtube.Song;
};

export type YoutubeSearchOf<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  options?: TOptions
) => Promise<YoutubeSearchResult[]>;

export type YoutubeDownloadResult = Youtube.Download;
