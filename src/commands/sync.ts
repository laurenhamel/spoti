import { Command } from "commander";
import { type SpotiCliOptions } from "../types";
import { getSpotifyType } from "../core";
import {
  parseSpotifyURL,
  isSpotifyURL,
  createActionHandler,
  Library,
} from "../utils";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export type SyncCliArgs = [string, string?];

export interface SyncCliOptions extends SpotiCliOptions {}

export default new Command()
  .name("sync")
  .description("Sync tracks from a Spotify URL to your local directory")
  .argument(
    "<query>",
    "Either an existing metadata file created from a previous sync or the initial Spotify URL to start syncing"
  )
  .argument(
    "[file]",
    "A metadata filename to output to when the <query> is a Spotify URL"
  )
  .allowUnknownOption(true)
  .action(
    createActionHandler<SyncCliArgs, SyncCliOptions>(
      async (query, file, options) => {
        if (isSpotifyURL(query)) {
          const { type, id } = parseSpotifyURL(query);
          const base = file ? basename(file, extname(query)) : id;
          const source = base + ".spoti";
          const path = join(Library.dir, source);

          if (existsSync(path)) {
            throw new Error(
              `A metadata file with name '${source}' already exists. Use 'spoti sync ${source}' instead.`
            );
          }

          // @TODO Trigger a download

          const data = { type, id, url: query };
          const json = JSON.stringify(data, null, 2);
          writeFileSync(path, json);
        } else {
          // @TODO Find metadata file
          const source = basename(query, extname(query)) + ".spoti";
          const path = join(Library.dir, source);

          if (!existsSync(path)) {
            throw new Error(
              `A metadata file with name '${source}' does not exist.`
            );
          }

          const data = JSON.parse(readFileSync(path, { encoding: "utf-8" }));
          const { type, id } = data as ReturnType<typeof parseSpotifyURL>;

          // @TODO Trigger a download

          const json = JSON.stringify(data, null, 2);
          writeFileSync(path, json);
        }
      }
    )
  );
