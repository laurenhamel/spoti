import { Download } from "./Download";
import { AudioFormat } from "./shared";

export type DownloadOf<TFormat extends AudioFormat> =
  TFormat extends AudioFormat.M4A
    ? Omit<Download, "format"> & { format: AudioFormat.M4A }
    : TFormat extends AudioFormat.MP3
    ? Omit<Download, "format"> & { format: AudioFormat.MP3 }
    : TFormat extends AudioFormat.MP4
    ? Omit<Download, "format"> & { format: AudioFormat.MP4 }
    : never;
