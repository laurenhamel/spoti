import { type Lastfm, type Musicbrainz } from "../models";
import { invokePlugins } from "../plugins";
import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/configuration";
import { type DownloadTarget, type DownloadResult } from "../types/download";
import { type TaggingResult } from "../types/tag";
import { createLabel } from "../utils/console";
import { Library } from "../utils/library";
import { pool } from "../utils/promise";
import { getConfigurationKey } from "./configuration";
import { mergeAndConcat } from "./helpers";
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
  upperFirst,
} from "lodash-es";
import fetch from "node-fetch";
import { type Tags, TagConstants } from "node-id3";
import { extname } from "node:path";

export const DEFAULT_GENRE_DELIMITER = ";";

export const DEFAULT_MUSICBRAINZ_GENRE_THRESHOLD = 3;

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

export function capitalizeGenre(value: string): string {
  const capitalizeAfter = (value: string, separator: string): string => {
    return value.trim().split(separator).map(upperFirst).join(separator);
  };

  const capitalizeWhere = (value: string, ...separators: string[]): string => {
    return separators.reduce(
      (value, separator) => capitalizeAfter(value, separator),
      value
    );
  };

  return capitalizeWhere(value, " ", "&", "-");
}

export function parseGenres(
  genres?: string | string[],
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string[] {
  return uniq(
    compact(castArray(genres)).flatMap((genre) =>
      uniq(genre.split(delimiter).map(capitalizeGenre))
    )
  );
}

export function parseMusicbrainzGenres(
  musicbrainz?: Musicbrainz.Recording,
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string[] {
  const enabled = defaultTo<boolean>(
    getConfigurationKey("musicbrainz.enabled"),
    true
  );

  if (!enabled) return [];

  const threshold = defaultTo<number>(
    getConfigurationKey("musicbrainz.genreThreshold"),
    DEFAULT_MUSICBRAINZ_GENRE_THRESHOLD
  );

  const recording = musicbrainz?.genres ?? [];
  const artist = musicbrainz?.["artist-credit"][0]?.artist.genres ?? [];

  const filterThreshold = (genre: Musicbrainz.Genre): boolean => {
    return genre.count >= threshold;
  };

  return [
    ...parseGenres(map(recording.filter(filterThreshold), "name"), delimiter),
    ...parseGenres(map(artist.filter(filterThreshold), "name"), delimiter),
  ];
}

export function parseLastfmGenres(
  lastfm?: Lastfm.Track,
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string[] {
  const enabled = defaultTo<boolean>(
    getConfigurationKey("lastfm.enabled"),
    true
  );

  if (!enabled) return [];

  const track = lastfm?.track.toptags.tag ?? [];

  return [...parseGenres(map(track, "name"), delimiter)];
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
  const { lastfm, musicbrainz } = search;

  const genres = [
    ...parseGenres(artists[0].genres?.[0], delimiter),
    ...parseLastfmGenres(lastfm, delimiter),
    ...parseMusicbrainzGenres(musicbrainz, delimiter),
  ];

  return genres.length ? stringifyGenres(genres) : undefined;
}

export function generateMusicbrainzTags(
  musicbrainz?: Musicbrainz.Recording
): Tags {
  return musicbrainz
    ? {
        uniqueFileIdentifier: [
          {
            ownerIdentifier: "http://musicbrainz.org",
            identifier: Buffer.from(musicbrainz.id),
          },
        ],
      }
    : {};
}

export async function generateTrackTag(item: DownloadTarget): Promise<Tags> {
  const result = item as DownloadTarget & { tags: Tags };

  const { item: track, download, search } = item;
  const { id } = track;
  const { file } = download;
  const { musicbrainz } = search;

  const format =
    (download.result as DownloadResult)?.item.download.format ??
    trimStart(extname(file), ".");

  if (includes(Object.values(AudioFormat), format)) {
    const image = await generateImageTag(
      track.album.images[0].url,
      track.album.name
    );

    const tags: Tags = mergeAndConcat(
      {
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
      },
      generateMusicbrainzTags(musicbrainz)
    );

    Library.assignId(tags, id);

    const merged = merge({}, result.tags, tags);

    await invokePlugins("transformTags", [item, merged]);

    result.tags = merged;
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
  const { id, path, tags: patch } = await getTrackTag(source, options);
  const { tags, save } = await Library.tag(path, patch, id);

  if (tags && !options?.dry) {
    try {
      await save();
      console.log(scope, chalk.green("✓"), title);
      return { source, tags, status: "passed" };
    } catch (e) {
      const error = e as Error;
      console.log(scope, chalk.red("𐄂"), title);
      return { source, tags, status: "failed", error };
    } finally {
      progress?.();
    }
  }

  progress?.();
  console.log(scope, chalk.gray("✓"), title);
  return { source, tags, status: "skipped" };
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
