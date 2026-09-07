import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type SpotifyTagResult,
  type SpotifyDownloadTarget,
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
  item: SpotifyDownloadTarget
): Promise<Tags> {
  const result = item as SpotifyTagResult;

  const { item: track, download } = item;
  const { id } = track;
  const { file } = download;

  const format =
    (download.result as YoutubeDownloadResult)?.outputs.audio.format ??
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
  input: SpotifyDownloadTarget | SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<{ id: string; path: string; tags?: Tags }> {
  const item =
    "search" in input || "download" in input
      ? (input as SpotifyDownloadTarget)
      : input.item;

  // prettier-ignore
  const path = item.download.result?.outputs.audio.path ?? item.download.outputs?.audio.path ?? item.download.path;
  const id = item.item.id;
  const tags = Library.exists(path) ? await generateTrackTag(item) : undefined;

  progress?.();
  return { id, path, tags };
}

export async function addTrackTag<
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  item: SpotifyDownloadTarget | SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<boolean> {
  const { id, path, tags } = await getTrackTag(item);

  if (tags && !options?.dry) {
    await Library.tag(path, tags, id);
    progress?.();
    return true;
  }

  progress?.();
  return false;
}

export async function addTrackTags<
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  items: (SpotifyDownloadTarget | SpotifyDownloadResult)[],
  options?: TOptions
): Promise<boolean[]> {
  const progress = new Progress({
    label: "Tagging…",
    total: items.length,
    color: chalk.blue,
  });

  const tasks = items.map(
    (item) => () => addTrackTag(item, options, () => progress.increment())
  );

  const dispatch = pool(25);
  const statuses = await dispatch(tasks);
  progress.done();
  return statuses;
}

/** @deprecated */
export async function hydrateTrackTags<TOptions extends SpotiOptions>(
  items: SpotifyDownloadTarget[],
  options?: TOptions,
  progress?: () => void
): Promise<boolean[]> {
  const dispatch = pool(25);

  const tasks = items.map((item) => () => addTrackTag(item, options, progress));

  return dispatch(tasks);
}
