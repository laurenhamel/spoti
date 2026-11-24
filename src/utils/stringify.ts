import { Spotify } from "../models";
import { type SpotiOptions } from "../types/configuration";
import {
  type LibraryFile,
  type LibraryMetadata,
} from "../types/library";
import { type SearchResult } from "../types/search";
import {
  type SpotifyTypeStringifier,
  type YoutubeSearchStringifier,
} from "../types/stringify";
import { Format } from "./format";
import { sortByKeys } from "./helpers";
import { Library } from "./library";
import chalk from "chalk";
import Table from "cli-table3";
import diff, { type Difference } from "microdiff";
import { map, padStart } from "lodash-es";
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
  const { youtube } = results[0] ?? {};

  const head = new Table({
    wordWrap: true,
    colWidths: [14],
  });

  head.push(...stringifyDetails(details));

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
    [chalk.green(id), chalk.red(youtube?.id)].join("\n"),
    [chalk.green(name), chalk.red(youtube?.title)].join("\n"),
    [
      chalk.green(map(artists, "name").join(", ")),
      chalk.red(map(youtube?.artists ?? [], "name").join(", ")),
    ].join("\n"),
    [
      chalk.green(Format.getDuration(data)),
      chalk.red(youtube?.duration?.text),
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
    const { track, youtube } = results[i];
    const count = padStart(`${i + 1}`, padding, "0");

    body.push([
      count,
      [chalk.green(track.id), chalk.red(youtube?.id)].join("\n"),
      [chalk.green(track.name), chalk.red(youtube?.title)].join("\n"),
      [
        chalk.green(map(track.artists, "name").join(", ")),
        chalk.red(map(youtube?.artists ?? [], "name").join(", ")),
      ].join("\n"),
      [
        chalk.green(Format.getDuration(track)),
        chalk.red(youtube?.duration?.text),
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
  results: SearchResult[],
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

function normalizeTags(tags: Tags = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(tags)) {
    switch (key) {
      case "image": {
        if (!value) break;

        const { mime, type, description } = value;

        result[key] = {
          mime,
          type,
          description,
          imageBuffer: "<Buffer>",
        };

        break;
      }

      case "imageBuffer": {
        result[key] = "<Buffer>";
        break;
      }

      case "userDefinedText": {
        const normalized: Record<string, unknown> = {};

        for (const item of value ?? []) {
          normalized[item.description] = item.value;
        }

        result[key] = sortByKeys(normalized);
        break;
      }

      case "uniqueFileIdentifier": {
        const normalized: Record<string, unknown> = {};

        for (const item of value ?? []) {
          normalized[item.ownerIdentifier] =
            stringifyBuffer(item.identifier);
        }

        result[key] = sortByKeys(normalized);
        break;
      }

      case "raw": {
        // Intentionally omitted.
        break;
      }

      default: {
        result[key] = value;
      }
    }
  }

  return result;
}

function stringifyBuffer(buffer: Buffer): string {
  return buffer.toString("hex");
}

function stringifyTags<TOptions extends SpotiOptions>(
  tags: Tags = {},
  _options?: TOptions
): string {
  return JSON.stringify(normalizeTags(tags), null, 2);
}

function diffTags<TOptions extends SpotiOptions>(
  previous: Tags = {},
  next: Tags = {},
  _options?: TOptions
): Difference[] {
  const src = normalizeTags(previous);
  const dest = normalizeTags(next);
  return diff(src, dest);
}

function stringifyTagsDiff<TOptions extends SpotiOptions>(
  previous: Tags = {},
  next: Tags = {},
  _options?: TOptions
): string {
  const changes = diffTags(previous, next);

  return changes
    .map((change) => {
      const path = change.path
        .map((part) =>
          typeof part === "number"
            ? `[${part}]`
            : `.${part}`
        )
        .join("")
        .replace(/^\./, "");

      switch (change.type) {
        case "CREATE": {
          return chalk.green(`+ ${path}: ${JSON.stringify(change.value)}\n`);
        }
        case "REMOVE": {
          return chalk.red(`- ${path}: ${JSON.stringify(change.oldValue)}\n`);
        }
        case "CHANGE": {
          const before = chalk.red(`- ${path}: ${JSON.stringify(change.oldValue)}\n`);
          const after = chalk.green(`+ ${path}: ${JSON.stringify(change.value)}\n`);
          return before + after;
        }
      }
    })
    .join("");
}

export async function stringifyFile<
  TOptions extends SpotiOptions & { more?: boolean },
>(
  file: LibraryFile,
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

  const metadata = await (async (): Promise<LibraryMetadata> => {
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
  })();

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
          [
            Heading.Tags,
            options?.dry
              ? stringifyTagsDiff(item.tags, item.tagging?.tags, options)
              : stringifyTags(item.tagging?.tags ?? item.tags, options),
          ],
        ]
      : []),
    ...stringifyDetails(details)
  );

  progress?.();

  return table.toString() + "\n";
}
