import { Format } from "./format";
import { Library } from "./library";
import { AudioFormat, VideoFormat } from "../types";
import { Youtube } from "../models";

export function getDownloadData(
  title: string,
  bitrate: number
): Record<AudioFormat | VideoFormat, Youtube.Download> {
  const data: Record<AudioFormat | VideoFormat, Youtube.Download> = {
    [AudioFormat.M4A]: {
      file: Format.hide(Library.file(title, AudioFormat.M4A)),
      path: Format.hide(Library.path(title, AudioFormat.M4A)),
      format: AudioFormat.M4A,
      bitrate,
    },
    [AudioFormat.MP3]: {
      file: Library.file(title, AudioFormat.MP3),
      path: Library.path(title, AudioFormat.MP3),
      format: AudioFormat.MP3,
      bitrate,
    },
    [AudioFormat.WAV]: {
      file: Library.file(title, AudioFormat.WAV),
      path: Library.path(title, AudioFormat.WAV),
      format: AudioFormat.WAV,
      bitrate,
    },
    [AudioFormat.AAC]: {
      file: Library.file(title, AudioFormat.AAC),
      path: Library.path(title, AudioFormat.AAC),
      format: AudioFormat.AAC,
      bitrate,
    },
    [VideoFormat.MP4]: {
      file: Format.hide(Library.file(title, VideoFormat.MP4)),
      path: Format.hide(Library.path(title, VideoFormat.MP4)),
      format: VideoFormat.MP4,
      bitrate,
    },
  };

  return data;
}
