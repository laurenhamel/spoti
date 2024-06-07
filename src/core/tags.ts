import {
  type SpotiOptions,
  type SpotifyDownloadResult,
  type YoutubeDownloadResult,
} from "../types";
import id3, { type Tags, TagConstants } from "node-id3";
import fetch from "node-fetch";
import { detectAudioFormat, pool, library } from "../utils";
import { map } from "lodash-es";
import { Youtube } from "../models";

async function generateImageTag(
  url: string,
  description = ""
): Promise<Tags["image"]> {
  try {
    const image = await fetch(url);
    const buffer = Buffer.from(await image.arrayBuffer());

    return {
      description,
      mime: image.headers.get("Content-Type") ?? "image/jpeg",
      type: { id: TagConstants.AttachedPicture.PictureType.FRONT_COVER },
      imageBuffer: buffer,
    };
  } catch (e) {
    // Image cannot be added to track ID3 tags
  }
}

export async function addTrackTag<TOptions extends SpotiOptions>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    if (item.download.result) {
      const { track, download, features } = item;
      const { path } = download.result as YoutubeDownloadResult;
      const format = detectAudioFormat(path);

      if (format !== Youtube.AudioFormat.MP3) {
        progress?.();
        return resolve();
      }

      const image = await generateImageTag(
        track.album.images[0].url,
        track.album.name
      );

      const tags: Tags = {
        title: track.name,
        artist: map(track.artists, "name").join(", "),
        album: track.album.name,
        genre: track.artists[0].genres?.[0],
        year: track.album.release_date.split("-")[0],
        fileUrl: track.href,
        trackNumber: track.track_number.toString(),
        bpm: features?.tempo.toString(),
        initialKey: features?.key.toString(),
        image,
      };

      await library.saveTags(path, track.id, tags);
      resolve();
    } else {
      progress?.();
      resolve();
    }
  });
}

export async function hydrateTrackTags<TOptions extends SpotiOptions>(
  items: SpotifyDownloadResult[],
  options?: TOptions,
  progress?: () => void
): Promise<void[]> {
  const dispatch = pool(25);

  const tasks: (() => Promise<void>)[] = items.map(
    (item) => () => addTrackTag(item, options, progress)
  );

  return dispatch(tasks);
}
