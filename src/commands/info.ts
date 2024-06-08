import { Command } from "commander";
import { type SpotiCliOptions } from "../types";
import { createActionHandler, Library, toDuration } from "../utils";
import chalk from "chalk";
import { Progress } from "../utils";
import Table from "cli-table3";

export type InfoCliArgs = [string?];

export interface InfoCliOptions extends SpotiCliOptions {
  save: boolean;
}

export default new Command()
  .name("info")
  .description("Read ID3 tag information from MP3 file(s)")
  .argument("[file]", "An MP3 file to read ID3 tags from")
  .option("-s, --save", "Rewrite the ID3 tags of the MP3 file(s)", false)
  .allowUnknownOption(true)
  .action(
    createActionHandler<InfoCliArgs, InfoCliOptions>(async (file, options) => {
      console.log(file, options);
      if (file && !Library.exists(file)) {
        throw new Error(`Could not find file '${file}'.`);
      }

      const files = file ? [file] : Library.files;
      const data = files.map((file) => ({ file, meta: Library.library[file] }));

      const progress$ = new Progress(
        "Reading…",
        {
          type: "percentage",
          percentage: 0,
          message: `0 / ${files.length}`,
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

      const head = ["File", "Format", "Id", "Size", "Duration"];
      const table$ = new Table({ head });

      for (const { file, meta } of data) {
        const { format, size, metadata } = meta;
        const { duration, id, tags } = await metadata();
        table$.push([file, format, id, size, toDuration(duration)]);
        progress$.report();
        options.save && Library.tag(file, tags, id);
      }

      progress$.done();
      progress$.remove();
      console.log();
      console.log(table$.toString());
      console.log();
    })
  );
