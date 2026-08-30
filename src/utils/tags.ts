import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type SpotifyTagResult,
  type SpotifyDownloadResult,
} from "../types/spotify";
import { type YoutubeDownloadResult } from "../types/youtube";
import { Library } from "../utils/library";
import { pool } from "../utils/promise";
import { includes, map } from "lodash-es";
import fetch from "node-fetch";
import { type Tags, TagConstants } from "node-id3";

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
  } catch (_) {
    // Image cannot be added to track ID3 tags
  }
}

export async function generateTrackTag(
  item: SpotifyDownloadResult
): Promise<Tags> {
  const result = item as SpotifyTagResult;

  if (result.download.result) {
    const { item: track, download } = item;
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
        image,
        // @TODO Use essentia.js for `initialKey` detection
        // @TODO Use essentia.js for `bpm` detection
      };
    }
  }

  result.tags = result.tags ?? {};

  return result.tags;
}

export async function addTrackTag<TOptions extends SpotiOptions>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  const id = item.item.id;
  const file = item.download.result?.file;
  const existing = file ? Library.find(file) : undefined;
  const src = existing?.raw?.file ?? file;

  if (src) {
    const tags = await generateTrackTag(item);
    await Library.tag(src, tags, id);
  }

  progress?.();
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
