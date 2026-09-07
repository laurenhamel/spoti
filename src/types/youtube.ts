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

export interface YoutubeDownloadResult {
  inputs: Record<"audio" | "video", Youtube.Download>;
  outputs: Record<"audio" | "video", Youtube.Download>;
}

export interface YoutubeDownloadMetadata extends YoutubeDownloadResult {
  title: string;
  song: Youtube.Song;
  url: string;
  metadata: Youtube.Metadata;
  formats: Record<"audio" | "video", Youtube.Format>;
}
