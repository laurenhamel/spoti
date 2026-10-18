import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/configuration";
import { type DownloadTarget, type DownloadResult } from "../types/download";
import { type TaggingResult } from "../types/tag";
import { createLabel } from "../utils/console";
import { Library } from "../utils/library";
import { pool } from "../utils/promise";
import { getConfigurationKey } from "./configuration";
import { Progress } from "./progress";
import chalk from "chalk";
import {
  compact,
  castArray,
  includes,
  isBoolean,
  map,
  merge,
  trimStart,
  defaultTo,
  uniq,
  trim,
} from "lodash-es";
import fetch from "node-fetch";
import { type Tags, TagConstants } from "node-id3";
import { extname } from "node:path";

export const DEFAULT_GENRE_DELIMITER = ";";

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

export function parseGenres(
  genres?: string | string[],
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string[] {
  return uniq(
    compact(castArray(genres)).flatMap((genre) =>
      uniq(genre.split(delimiter).map(trim))
    )
  );
}

export function stringifyGenres(
  genres: string[],
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string {
  return genres.join(`${delimiter} `);
}

function generateGenreTag(item: DownloadTarget): string | undefined {
  const delimiter = defaultTo<string>(
    getConfigurationKey("tags.genreDelimiter"),
    DEFAULT_GENRE_DELIMITER
  );

  const { item: track, search } = item;
  const { artists } = track;
  const { lastfm } = search;

  const genres = [
    ...parseGenres(artists[0].genres?.[0], delimiter),
    ...parseGenres(map(lastfm?.track.toptags.tag ?? [], "name")),
  ];

  return genres.length ? stringifyGenres(genres) : undefined;
}

export async function generateTrackTag(item: DownloadTarget): Promise<Tags> {
  const result = item as DownloadTarget & { tags: Tags };

  const { item: track, download } = item;
  const { id } = track;
  const { file } = download;

  const format =
    (download.result as DownloadResult)?.item.download.format ??
    trimStart(extname(file), ".");

  if (includes(Object.values(AudioFormat), format)) {
    const image = await generateImageTag(
      track.album.images[0].url,
      track.album.name
    );

    const tags: Tags = {
      title: track.name,
      artist: map(track.artists, "name").join(", "),
      album: track.album.name,
      genre: generateGenreTag(item),
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
  input: DownloadTarget | DownloadResult,
  options?: TOptions,
  progress?: () => void
): Promise<{ id: string; path: string; tags?: Tags }> {
  const item =
    "search" in input || "download" in input
      ? (input as DownloadTarget)
      : input.item;

  const converted = isBoolean(options?.convert) ? options.convert : true;

  const path = converted
    ? (item.download.result?.item.download.output.path ??
      item.download.output?.path ??
      item.download.path)
    : (item.download.result?.item.download.input.path ??
      item.download.input?.path ??
      item.download.path);

  const id = item.item.id;
  const tags = Library.exists(path) ? await generateTrackTag(item) : undefined;

  progress?.();
  return { id, path, tags };
}

export async function addTrackTag<
  TSource extends DownloadTarget | DownloadResult,
  TOptions extends SpotiOptions & { dry?: boolean },
>(
  source: TSource,
  options?: TOptions,
  progress?: () => void
): Promise<TaggingResult<TSource>> {
  const item =
    "search" in source || "download" in source
      ? (source as DownloadTarget)
      : source.item;

  const { title } = item.download;
  const scope = createLabel("tag");
  const { id, path, tags } = await getTrackTag(source, options);

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
  TSource extends DownloadTarget | DownloadResult,
  TOptions extends SpotiOptions & { dry?: boolean },
>(items: TSource[], options?: TOptions): Promise<TaggingResult<TSource>[]> {
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
