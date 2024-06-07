import { type Innertube } from "youtubei.js";

export type InnertubeApiInstance = Awaited<ReturnType<typeof Innertube.create>>;

export enum AudioFormat {
  M4A = "m4a",
  MP4 = "mp4",
  MP3 = "mp3",
}
