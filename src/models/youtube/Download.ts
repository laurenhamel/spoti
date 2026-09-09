import { type AudioFormat } from "../../types/audio";
import { type VideoFormat } from "../../types/video";
import { type Metadata } from "./Metadata";

export type DownloadPath = {
  format: VideoFormat | AudioFormat;
  file: string;
  path: string;
};

export type Download = DownloadPath & {
  bitrate: number;
  size: number;
  duration: number;
  metadata: Metadata;
  type: "video" | "audio";
};
