import { Spotify } from "../models";
import { type SpotiOptions } from "../types/config";
import {
  type LibraryFile,
  type LibraryMetadata,
  type LibraryManifest,
} from "../types/library";
import {
  type SpotifyTypeStringifier,
  type YoutubeSearchStringifier,
} from "../types/stringify";
import { type YoutubeSearchResult } from "../types/youtube";
import { Format } from "./format";
import { Library } from "./library";
import { pool } from "./promise";
import chalk from "chalk";
import Table from "cli-table3";
import stringify from "fast-safe-stringify";
import { map, padStart, sortBy, zipObject } from "lodash-es";
import { type Tags } from "node-id3";
import { type Primitive } from "type-fest";
import window from "window-size";

function stringifyDetails(details?: Record<string, Primitive>): string[][] {
  return details
    ? map(details, (value, key) => {
        return [chalk.bold(key), String(value)];
      })
    : [];
}

const stringifyNoopInfo: SpotifyTypeStringifier<Spotify.Type> = () => "";

const stringifyNoopSearch: YoutubeSearchStringifier<Spotify.Type> = () => "";

const stringifyTrackInfo: SpotifyTypeStringifier<Spotify.Type.TRACK> = (
  data,
  options,
  details
) => {
  const { id, name, artists } = data;

  const table = new Table({
    wordWrap: true,
    colWidths: [14],
  });

  table.push(
    [chalk.bold("ID"), id],
    [chalk.bold("Track"), name],
    [chalk.bold("Artist"), map(artists, "name").join(", ")],
    [chalk.bold("Duration"), Format.getDuration(data)],
    ...stringifyDetails(details)
  );

  return table.toString();
};

const stringifyTrackSearch: YoutubeSearchStringifier<Spotify.Type.TRACK> = (
  data,
  results,
  options,
  details
) => {
  const { id, name, artists } = data;
  const { query, result } = results[0] ?? {};

  const head = new Table({
    wordWrap: true,
    colWidths: [14],
  });

  head.push([chalk.bold("Query"), query], ...stringifyDetails(details));

  const body = new Table({
    wordWrap: true,
    colWidths: [
      24,
      Math.floor((window.width - 24 - 10 - 6) * 0.5),
      Math.floor((window.width - 24 - 10 - 6) * 0.5),
      10,
    ],
    head: [
      chalk.bold.blue("ID"),
      chalk.bold.blue("Track"),
      chalk.bold.blue("Artist"),
      chalk.bold.blue("Duration"),
    ],
  });

  body.push([
    [chalk.green(id), chalk.red(result?.id)].join("\n"),
    [chalk.green(name), chalk.red(result?.title)].join("\n"),
    [
      chalk.green(map(artists, "name").join(", ")),
      chalk.red(map(result?.artists ?? [], "name").join(", ")),
    ].join("\n"),
    [
      chalk.green(Format.getDuration(data)),
      chalk.red(result?.duration?.text),
    ].join("\n"),
  ]);

  return [head.toString() + "\n", body.toString()].join("\n");
};

const stringifyPlaylistInfo: SpotifyTypeStringifier<Spotify.Type.PLAYLIST> = (
  data,
  options,
  details
) => {
  const { id, description, name, items: tracks } = data;
  const owner = data.owner.display_name;
  const length = tracks.items.length;
  const padding = `${length}`.length;

  const head = new Table({
    wordWrap: true,
    colWidths: [14],
  });

  head.push(
    [chalk.bold("ID"), id],
    [chalk.bold("Playlist"), name],
    [chalk.bold("Description"), description],
    [chalk.bold("Songs"), length],
    [chalk.bold("Owner"), owner],
    ...stringifyDetails(details)
  );

  const body = new Table({
    colWidths: [
      padding + 2,
      24,
      Math.floor((window.width - (padding + 2) - 24 - 10 - 6) * 0.5),
      Math.floor((window.width - (padding + 2) - 24 - 10 - 6) * 0.5),
      10,
    ],
    head: [
      chalk.bold.blue("#"),
      chalk.bold.blue("ID"),
      chalk.bold.blue("Track"),
      chalk.bold.blue("Artist"),
      chalk.bold.blue("Duration"),
    ],
  });

  for (let i = 0; i < length; i++) {
    const track = tracks.items[i];
    const count = padStart(`${i + 1}`, padding, "0");

    body.push([
      count,
      track.item.id,
      track.item.name,
      map(track.item.artists, "name").join(", "),
      Format.getDuration(track.item),
    ]);
  }

  return [head.toString() + "\n", body.toString()].join("\n");
};

const stringifyPlaylistSearch: YoutubeSearchStringifier<
  Spotify.Type.PLAYLIST
> = (data, results, options, details) => {
  const { id, name, description } = data;
  const owner = data.owner.display_name;
  const length = results.length;
  const padding = `${length}`.length;

  const head = new Table({
    wordWrap: true,
    colWidths: [14],
  });

  head.push(
    [chalk.bold("ID"), id],
    [chalk.bold("Playlist"), name],
    [chalk.bold("Description"), description],
    [chalk.bold("Songs"), length],
    [chalk.bold("Owner"), owner],
    ...stringifyDetails(details)
  );

  const body = new Table({
    colWidths: [
      padding + 2,
      24,
      Math.floor((window.width - (padding + 2) - 24 - 10 - 6) * 0.5),
      Math.floor((window.width - (padding + 2) - 24 - 10 - 6) * 0.5),
      10,
    ],
    head: [
      chalk.bold.blue("#"),
      chalk.bold.blue("ID"),
      chalk.bold.blue("Track"),
      chalk.bold.blue("Artist"),
      chalk.bold.blue("Duration"),
    ],
  });

  for (let i = 0; i < length; i++) {
    const { track, query, result } = results[i];
    const count = padStart(`${i + 1}`, padding, "0");

    body.push([
      count,
      [chalk.green(track.id), chalk.red(result?.id)].join("\n"),
      [
        chalk.green(track.name),
        chalk.red(result?.title),
        chalk.gray(`"${query}"`),
      ].join("\n"),
      [
        chalk.green(map(track.artists, "name").join(", ")),
        chalk.red(map(result?.artists ?? [], "name").join(", ")),
      ].join("\n"),
      [
        chalk.green(Format.getDuration(track)),
        chalk.red(result?.duration?.text),
      ].join("\n"),
    ]);
  }

  return [head.toString() + "\n", body.toString()].join("\n");
};

export function stringifyType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  options: TOptions,
  details?: Record<string, Primitive>
): string {
  const callees: { [TType in Spotify.Type]: SpotifyTypeStringifier<TType> } = {
    [Spotify.Type.ALBUM]: stringifyNoopInfo,
    [Spotify.Type.ARTIST]: stringifyNoopInfo,
    [Spotify.Type.FEATURES]: stringifyNoopInfo,
    [Spotify.Type.PLAYLIST]: stringifyPlaylistInfo,
    [Spotify.Type.TRACK]: stringifyTrackInfo,
    [Spotify.Type.USER]: stringifyNoopInfo,
  };

  const callee = callees[type];

  return callee<TOptions>(data, options, details);
}

export function stringifySearch<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  results: YoutubeSearchResult[],
  options: TOptions,
  details?: Record<string, Primitive>
): string {
  const callees: { [TType in Spotify.Type]: YoutubeSearchStringifier<TType> } =
    {
      [Spotify.Type.ALBUM]: stringifyNoopSearch,
      [Spotify.Type.ARTIST]: stringifyNoopSearch,
      [Spotify.Type.FEATURES]: stringifyNoopSearch,
      [Spotify.Type.PLAYLIST]: stringifyPlaylistSearch,
      [Spotify.Type.TRACK]: stringifyTrackSearch,
      [Spotify.Type.USER]: stringifyNoopSearch,
    };

  const callee = callees[type];

  return callee<TOptions>(data, results, options, details);
}

function stringifyTags<TOptions extends SpotiOptions>(
  tags: Tags = {},
  _options?: TOptions
): string {
  return stringify(
    tags,
    (key, value) => {
      switch (key) {
        case "image": {
          return "[Image]";
        }
        case "userDefinedText": {
          const keys = map(value, "description");
          const values = map(value, "value");
          return zipObject(keys, values);
        }
        case "raw": {
          return;
        }
        default: {
          return value;
        }
      }
    },
    2
  );
}

export async function stringifyManifest<
  TOptions extends SpotiOptions & { more?: boolean },
>(
  manifest: LibraryManifest,
  options: TOptions,
  details?: Record<string, Primitive>,
  progress?: () => void
): Promise<string> {
  const Heading = {
    Title: chalk.bold.blue("Title"),
    File: chalk.bold.blue("File"),
    Format: chalk.bold.blue("Format"),
    Size: chalk.bold.blue("Size"),
    Duration: chalk.bold.blue("Duration"),
    Id: chalk.bold.blue("Id"),
    Tags: chalk.bold.blue("Tags"),
  };

  async function readMetadata(file: LibraryFile): Promise<LibraryMetadata> {
    if (options?.more) {
      return file.tags
        ? {
            tags: file.tags,
            duration: file.duration ?? Library.duration(file.file, file.tags),
            id: file.id,
          }
        : file.metadata();
    }

    return {
      tags: {},
      duration: file.duration ?? 0,
      id: file.id,
    };
  }

  const tasks = sortBy(manifest.files, "title").map(
    (file) => async (): Promise<string> => {
      const metadata = await readMetadata(file);
      const item = { ...file, ...metadata };

      const table = new Table({
        colWidths: [10, window.width - 10 - 6],
      });

      table.push(
        [Heading.Title, item.title],
        [Heading.File, item.file],
        [Heading.Format, item.format],
        [Heading.Size, Format.bytes(item.size)],
        ...(options?.more
          ? [
              [Heading.Id, item.id],
              [Heading.Duration, Format.duration(item.duration)],
              [Heading.Tags, stringifyTags(item.tags)],
            ]
          : []),
        ...stringifyDetails(details)
      );

      progress?.();

      return table.toString() + "\n";
    }
  );

  const dispatch = pool(25);
  const results = await dispatch(tasks);
  return results.join("\n");
}
