import { Command } from "commander";
import {
  Metadata,
  prepareDownloadResults,
  Spoti,
  generateTrackTag,
} from "../core";
import { type SpotiCliOptions, type SpotifyMetadataResult } from "../types";
import {
  createActionHandler,
  Library,
  type LibraryItem,
  Progress,
  Duration,
  Size,
  type LibraryMetadata,
  pool,
} from "../utils";
import chalk from "chalk";
import Table, { HorizontalTableRow } from "cli-table3";
import { compact, map, sortBy, zipObject } from "lodash-es";
import Window from "window-size";
import stringify from "fast-safe-stringify";

export type LibraryCliArgs = [string?];

export interface LibraryCliOptions extends SpotiCliOptions {
  more: boolean;
}

export default new Command()
  .name("library")
  .description("Retrieve information about your music library")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("-m, --more", "Output more data (ID3 tags and duration)", false)
  .allowUnknownOption(true)
  .action(
    createActionHandler<LibraryCliArgs, LibraryCliOptions>(
      async (file, options) => {
        type FileInfo = LibraryItem & Partial<LibraryMetadata>;

        const data: FileInfo[] = [];

        if (file && Library.exists(file)) {
          data.push(Library.parse(file));
        } else if (file && Metadata.has(file)) {
          const { id, type } = Metadata.read<SpotifyMetadataResult>(file);
          const items = await Spoti.search(id, type, options);
          const prepared = prepareDownloadResults(options)(items);

          for (const item of prepared) {
            const id = item.track.id;
            const duration = item.track.duration_ms;
            const tags = await generateTrackTag(item);
            data.push({
              ...Library.parse(item.download.file),
              id,
              tags,
              duration,
            });
          }
        } else {
          data.push(...Library.library);
        }

        const progress$ = new Progress(
          "Scanning…",
          {
            type: "percentage",
            percentage: 0,
            message: `0 / ${data.length}`,
            nameTransformFn: chalk.blue,
          },
          (() => {
            let reports = 0;
            return () => {
              reports++;
              const percentage = reports / data.length;
              const message = `${reports} / ${data.length}`;
              progress$.update(percentage, message);
            };
          })()
        );

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

        const tasks = sortBy(data, "title").map(
          (item) => () =>
            new Promise<FileInfo>(async (resolve) => {
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

              progress$.report();
              resolve(item);
            }).then((item) => {
              const table = new Table();

              const rows: HorizontalTableRow[] = [
                [HEADING.Title, Progress.label(item.title, CLAMP)],
                [HEADING.File, item.file],
                [HEADING.Format, item.format],
                [HEADING.Size, Size.format(item.size)],
              ];

              if (options?.more) {
                rows.push(
                  [HEADING.Id, item.id ?? "-"],
                  [HEADING.Duration, Duration.format(item.duration as number)],
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

              console.log("");
              console.log(table.toString());
            })
        );

        await dispatch(tasks);
      }
    )
  );
