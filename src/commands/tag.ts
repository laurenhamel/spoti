import { prepareDownloadResults } from "../core/downloads";
import { Metadata } from "../core/metadata";
import { Spoti } from "../core/spoti";
import { generateTrackTag } from "../core/tags";
import { type SpotiOptions } from "../types/config";
import { type SpotifyMetadataResult } from "../types/spotify";
import { createAction } from "../utils/action";
import { Duration } from "../utils/duration";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import chalk from "chalk";
import Table from "cli-table3";
import { Command } from "commander";
import { sortBy } from "lodash-es";
import { type Tags } from "node-id3";

export type TagCliArgs = [string?];

export interface TagCliOptions extends SpotiOptions {
  update: boolean;
}

export default new Command()
  .name("tag")
  .description("Read ID3 tag(s) from MP3 file(s)")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("-u, --update", "Update the ID3 tag(s) of the MP3 file(s)", false)
  .action(
    createAction<TagCliArgs, TagCliOptions>(async (file, options) => {
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
          const id = item.item.id;
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

      console.log("");
      console.log(table$.toString());
    })
  );
