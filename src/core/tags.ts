import {
  AudioFormat,
  SpotifyTagResult,
  type SpotiOptions,
  type SpotifyDownloadResult,
  type YoutubeDownloadResult,
} from "../types";
import { type Tags, TagConstants } from "node-id3";
import fetch from "node-fetch";
import { pool, Library } from "../utils";
import { includes, map } from "lodash-es";

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

export async function generateTrackTag(
  item: SpotifyDownloadResult
): Promise<Tags> {
  const result = item as SpotifyTagResult;

  if (result.download.result) {
    const { track, download, features } = item;
    const { format } = download.result as YoutubeDownloadResult;

    if (includes(Object.values(AudioFormat), format)) {
      const image = await generateImageTag(
        track.album.images[0].url,
        track.album.name
      );

      result.tags = {
        title: track.name,
        artist: map(track.artists, "name").join(", "),
        album: track.album.name,
        genre: track.artists[0].genres?.[0],
        year: track.album.release_date.split("-")[0],
        fileUrl: track.href,
        trackNumber: track.track_number.toString(),
        bpm: features?.tempo?.toString(),
        initialKey: features?.key?.toString(),
        image,
      };
    }
  }

  result.tags = result.tags ?? ({} as Tags);

  return result.tags;
}

export async function addTrackTag<TOptions extends SpotiOptions>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  return new Promise(async (resolve) => {
    const id = item.track.id;
    const path = item.download.result?.path;

    if (path) {
      const tags = await generateTrackTag(item);
      await Library.tag(path, tags, id);
    }

    progress?.();
    resolve();
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
