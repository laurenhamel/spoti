import { Command } from "commander";
import { type SpotiCliOptions } from "../types";
import { getSpotifyType } from "../core";
import {
  parseSpotifyURL,
  validateSpotifyURL,
  createActionHandler,
} from "../utils";
import chalk from "chalk";

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
  .action(
    createActionHandler<SyncCliArgs, SyncCliOptions>(
      async (query, file, options) => {
        validateSpotifyURL(query);

        const { type, id } = parseSpotifyURL(query);

        console.log(`Downloading ${chalk.magenta(type)} (${chalk.blue(id)})…`);

        if (options.verbose) {
          console.log();
          console.log(chalk.bold.dim("Data"));
          console.log({ type, id });
          console.log();
        }

        const meta = await getSpotifyType(id, type, options);

        switch (type) {
          default: {
            throw new Error(`Sorry, downloading ${type}s not yet supported.`);
          }
        }
      }
    )
  );
