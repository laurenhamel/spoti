import { type AudioFormat } from "../../types/audio";
import { type VideoFormat } from "../../types/video";

export type Download = {
  file: string;
  path: string;
  format: AudioFormat | VideoFormat;
  bitrate?: number;
};
