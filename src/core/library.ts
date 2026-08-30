import { Metadata } from "../core/metadata";
import { Spoti } from "../core/spoti";
import { generateTrackTag } from "../core/tags";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { type LibraryFile, type LibraryMetadata } from "../types/library";
import { type SpotifyMetadataResult } from "../types/spotify";
import { mergeOptions } from "../utils/action";
import { prepareDownloadResults } from "../utils/downloads";
import { Duration } from "../utils/duration";
import { Library } from "../utils/library";
import { ProgressV2 } from "../utils/progress";
import { pool } from "../utils/promise";
import { Size } from "../utils/size";
import chalk from "chalk";
import Table, { type HorizontalTableRow } from "cli-table3";
import stringify from "fast-safe-stringify";
import { compact, map, sortBy, zipObject } from "lodash-es";
import Window from "window-size";

export type LibraryArguments = [string];

export interface LibraryOptions extends SpotiOptions {
  cache: boolean;
  more: boolean;
}

const LIBRARY_DEFAULTS: LibraryOptions = {
  cache: true,
  more: false,
  verbose: false,
};

export const library: ActionHandler<LibraryArguments, LibraryOptions> = async <
  TOptions extends LibraryOptions,
>(
  file?: string,
  config?: TOptions
) => {
  const options = mergeOptions(LIBRARY_DEFAULTS, config);

  const files: LibraryFile[] = [];

  if (file && Library.exists(file)) {
    files.push(Library.parse(file));
  } else if (file && Metadata.has(file)) {
    const { id, type } = Metadata.read<SpotifyMetadataResult>(file);
    const items = await Spoti.search(id, type, options);
    const prepared = prepareDownloadResults(options)(items);

    for (const item of prepared) {
      const id = item.item.id;
      const duration = item.item.duration_ms;
      const tags = await generateTrackTag(item);
      files.push({
        ...Library.parse(item.download.file),
        id,
        tags,
        duration,
      });
    }
  } else {
    files.push(...Library.library);
  }

  const progress = new ProgressV2({
    label: "Scanning…",
    total: files.length,
    color: chalk.blue,
  });

  const HEADING = {
    Title: chalk.bold.red("Title"),
    File: chalk.bold.red("File"),
    Format: chalk.bold.red("Format"),
    Size: chalk.bold.red("Size"),
    Duration: chalk.bold.red("Duration"),
    Id: chalk.bold.red("Id"),
    Tags: chalk.bold.red("Tags"),
  };

  const MIN = Math.max(...map(Object.keys(HEADING), "length"));
  const PADDING = 10;
  const CLAMP = Window.width - MIN - PADDING;

  const dispatch = pool(25);

  const tasks = sortBy(files, "title").map((item) => async () => {
    const metadata: LibraryMetadata = options?.more
      ? item.tags
        ? {
            tags: item.tags,
            duration: item.duration ?? Library.duration(item.file),
            id: item.id,
          }
        : await item.metadata()
      : {
          tags: {},
          duration: item.duration ?? 0,
          id: item.id,
        };

    item.tags = metadata.tags;
    item.id = metadata.id;
    item.duration = metadata.duration;

    progress.increment();

    const table = new Table();

    const rows: HorizontalTableRow[] = [
      [HEADING.Title, ProgressV2.label(item.title, CLAMP)],
      [HEADING.File, item.file],
      [HEADING.Format, item.format],
      [HEADING.Size, Size.format(item.size)],
    ];

    if (options?.more) {
      rows.push(
        [HEADING.Id, item.id ?? "-"],
        [HEADING.Duration, Duration.format(item.duration)],
        [
          HEADING.Tags,
          stringify(
            item.tags,
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
          ),
        ]
      );
    }

    table.push(...compact(rows));
    progress.done();
    console.log("");
    console.log(table.toString());
  });

  await dispatch(tasks);
};
