import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type SpotifyDownloadTarget,
  type SpotifyDownloadResult,
  type SpotifyTaggingResult,
} from "../types/spotify";
import { type YoutubeDownloadResult } from "../types/youtube";
import { createLabel } from "../utils/console";
import { Library } from "../utils/library";
import { pool } from "../utils/promise";
import { Progress } from "./progress";
import chalk from "chalk";
import { includes, isBoolean, map, merge, trimStart } from "lodash-es";
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
  const result = item as SpotifyDownloadTarget & { tags: Tags };

  const { item: track, download } = item;
  const { id } = track;
  const { file } = download;

  const format =
    (download.result as YoutubeDownloadResult)?.output.format ??
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

export async function getTrackTag<
  TOptions extends SpotiOptions & { convert?: boolean },
>(
  input: SpotifyDownloadTarget | SpotifyDownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<{ id: string; path: string; tags?: Tags }> {
  const item =
    "search" in input || "download" in input
      ? (input as SpotifyDownloadTarget)
      : input.item;

  const converted = isBoolean(options?.convert) ? options.convert : true;

  const path = converted
    ? (item.download.result?.output.path ??
      item.download.output?.path ??
      item.download.path)
    : (item.download.result?.input.path ??
      item.download.input?.path ??
      item.download.path);

  const id = item.item.id;
  const tags = Library.exists(path) ? await generateTrackTag(item) : undefined;

  progress?.();
  return { id, path, tags };
}

export async function addTrackTag<
  TSource extends SpotifyDownloadTarget | SpotifyDownloadResult,
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  source: TSource,
  options?: TOptions,
  progress?: () => void
): Promise<SpotifyTaggingResult<TSource>> {
  const item =
    "search" in source || "download" in source
      ? (source as SpotifyDownloadTarget)
      : source.item;

  const { title } = item.download;
  const scope = createLabel("tag");
  const { id, path, tags } = await getTrackTag(source);

  if (tags && !options?.dry) {
    try {
      await Library.tag(path, tags, id);
      console.log(scope, chalk.green("✓"), title);
      return { source, status: "passed" };
    } catch (e) {
      const error = e as Error;
      console.log(scope, chalk.red("𐄂"), title);
      return { source, status: "failed", error };
    } finally {
      progress?.();
    }
  }

  progress?.();
  console.log(scope, chalk.gray("✓"), title);
  return { source, status: "skipped" };
}

export async function addTrackTags<
  TSource extends SpotifyDownloadTarget | SpotifyDownloadResult,
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  items: TSource[],
  options?: TOptions
): Promise<SpotifyTaggingResult<TSource>[]> {
  const progress = new Progress({
    label: "Tagging…",
    total: items.length,
    color: chalk.blue,
  });

  const tasks = items.map(
    (item) => () => addTrackTag(item, options, () => progress.increment())
  );

  const dispatch = pool(25);
  const conversions = await dispatch(tasks);
  progress.done();
  return conversions;
}
