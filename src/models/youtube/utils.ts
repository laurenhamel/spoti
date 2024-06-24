import { Download } from "./Download";
import { type AudioFormat, type VideoFormat } from "../../types";

export type DownloadOf<TFormat extends AudioFormat | VideoFormat> =
  TFormat extends typeof AudioFormat.M4A
    ? Omit<Download, "format"> & { format: typeof AudioFormat.M4A }
    : TFormat extends typeof AudioFormat.MP3
    ? Omit<Download, "format"> & { format: typeof AudioFormat.MP3 }
    : TFormat extends typeof AudioFormat.WAV
    ? Omit<Download, "format"> & { format: typeof AudioFormat.WAV }
    : TFormat extends typeof AudioFormat.AAC
    ? Omit<Download, "format"> & { format: typeof AudioFormat.AAC }
    : TFormat extends typeof VideoFormat.MP4
    ? Omit<Download, "format"> & { format: typeof VideoFormat.MP4 }
    : never;
