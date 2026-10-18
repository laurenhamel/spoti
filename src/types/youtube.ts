import { type Youtube } from "../models";

export interface YoutubeDownloadResult {
  input: Youtube.Download;
  output: Youtube.Download;
}

export interface YoutubeDownloadMetadata extends YoutubeDownloadResult {
  title: string;
  song: Youtube.Song;
  url: string;
  metadata: Youtube.Metadata;
}
