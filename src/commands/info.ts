import { Command } from "commander";
import {
  Metadata,
  prepareDownloadResults,
  Spoti,
  generateTrackTag,
} from "../core";
import { type SpotifyMetadataResult, type SpotiCliOptions } from "../types";
import { createActionHandler, Library, Progress, Duration } from "../utils";
import chalk from "chalk";
import Table from "cli-table3";
import { sortBy } from "lodash-es";
import { Tags } from "node-id3";

export type InfoCliArgs = [string?];

export interface InfoCliOptions extends SpotiCliOptions {
  update: boolean;
}

export default new Command()
  .name("info")
  .description("Read ID3 tag information from MP3 file(s)")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("-u, --update", "Update the ID3 tags of the MP3 file(s)", false)
  .allowUnknownOption(true)
  .action(
    createActionHandler<InfoCliArgs, InfoCliOptions>(async (file, options) => {
      const files: { title: string; file: string; id?: string; tags?: Tags }[] =
        [];

      if (file && Library.exists(file)) {
        const title = Library.title(file);
        files.push({ file, title });
      } else if (file && Metadata.has(file)) {
        const { type, id } = Metadata.read<SpotifyMetadataResult>(file);
        const items = await Spoti.search(id, type, options);
        const prepared = prepareDownloadResults(options)(items);
        const data: {
          file: string;
          path: string;
          title: string;
          id?: string;
          tags?: Tags;
        }[] = [];

        for (const item of prepared) {
          const { file, path, title } = item.download;
          const id = item.track.id;
          const tags = await generateTrackTag(item);
          data.push({ file, path, title, id, tags });
        }

        const sorted = sortBy(data, "title");

        files.push(...sorted);
      } else {
        const sorted = Library.files.sort();
        const mapped = sorted.map((file) => ({
          file,
          title: Library.title(file),
        }));
        files.push(...mapped);
      }

      const data = files.map(({ title, file, id, tags }) => ({
        title,
        file,
        id,
        tags,
        meta: Library.get(file),
      }));

      const progress$ = new Progress(
        "Scanning…",
        {
          type: "percentage",
          percentage: 0,
          message: `0 / ${files.length}`,
          nameTransformFn: chalk.blue,
        },
        (() => {
          let reports = 0;
          return () => {
            reports++;
            const percentage = reports / files.length;
            const message = `${reports} / ${files.length}`;
            progress$.update(percentage, message);
          };
        })()
      );

      const head = ["Title", "Format", "ID", "Size", "Duration"];
      const table$ = new Table({ head });

      const missing: string[] = [];

      for (const item of data) {
        const label = Progress.label(item.title, 100);

        if (item.meta) {
          const { format, size, metadata } = item.meta;
          const { duration, id = item.id, tags } = await metadata();
          table$.push([label, format, id, size, Duration.format(duration)]);

          if (options.update) {
            const patch = { ...tags, ...item.tags };
            await Library.tag(item.file, patch, id, duration);
          }
        } else {
          missing.push(item.file);
          table$.push([chalk.dim(label), "-", "-", "-", "-"]);
        }

        progress$.report();
      }

      progress$.done();
      progress$.remove();

      console.log("");
      console.log(table$.toString());
    })
  );
