import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type SpotifyTagResult,
  type SpotifyDownloadResult,
} from "../types/spotify";
import { type YoutubeDownloadResult } from "../types/youtube";
import { Library } from "../utils/library";
import { pool } from "../utils/promise";
import { Progress } from "./progress";
import chalk from "chalk";
import { includes, map, merge, trimStart } from "lodash-es";
import fetch from "node-fetch";
import { type Tags, TagConstants } from "node-id3";
import { extname } from "node:path";

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

  const { item: track, download } = item;
  const { id } = track;
  const { file } = download;

  const format =
    (download.result as YoutubeDownloadResult)?.format ??
    trimStart(extname(file), ".");

  if (includes(Object.values(AudioFormat), format)) {
    const image = await generateImageTag(
      track.album.images[0].url,
      track.album.name
    );

    const tags = {
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

    Library.assignId(tags, id);

    result.tags = merge({}, result.tags, tags);
  }

  result.tags = result.tags ?? {};

  return result.tags;
}

export async function getTrackTag<TOptions extends SpotiOptions>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<{ id: string; src?: string; tags: Tags }> {
  const id = item.item.id;
  const file = item.download.result?.file ?? item.download.file;
  const existing = file ? Library.find(file) : undefined;
  const src = existing?.raw?.file ?? file;
  const tags = src ? await generateTrackTag(item) : {};
  progress?.();
  return { id, src, tags };
}

export async function getTrackTags<TOptions extends SpotiOptions>(
  items: SpotifyDownloadResult[],
  options?: TOptions
): Promise<{ id: string; src?: string; tags: Tags }[]> {
  const progress = new Progress({
    label: "Generating tags…",
    total: items.length,
    color: chalk.yellow,
  });

  const results = await Promise.all(
    items.map((item) => getTrackTag(item, options, () => progress.increment()))
  );

  progress.done();

  return results;
}

export async function addTrackTag<
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  item: SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  const { id, src, tags } = await getTrackTag(item);

  if (src && !options?.dry) {
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
