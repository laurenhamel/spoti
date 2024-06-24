import { type AudioFormat, type VideoFormat } from "../../types";

export type Download = {
  file: string;
  path: string;
  format: AudioFormat | VideoFormat;
  bitrate?: number;
};
