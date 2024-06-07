import { Youtube } from "../models";
import { getFilePath } from "./file";

export function getYoutubeDownloadData(
  title: string
): Record<Youtube.AudioFormat, Youtube.Download> {
  const data: Record<Youtube.AudioFormat, Youtube.Download> = {
    [Youtube.AudioFormat.M4A]: {
      title,
      path: getFilePath(title, Youtube.AudioFormat.M4A),
      format: Youtube.AudioFormat.M4A,
    },
    [Youtube.AudioFormat.MP4]: {
      title,
      path: getFilePath(title, Youtube.AudioFormat.MP4),
      format: Youtube.AudioFormat.MP4,
    },
    [Youtube.AudioFormat.MP3]: {
      title,
      path: getFilePath(title, Youtube.AudioFormat.MP3),
      format: Youtube.AudioFormat.MP3,
    },
  };

  return data;
}
