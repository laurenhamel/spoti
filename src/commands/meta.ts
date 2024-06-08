import { Command } from "commander";
import { type SpotiCliOptions } from "../types";
import { getSpotifyType } from "../core";
import {
  parseSpotifyURL,
  validateSpotifyURL,
  createActionHandler,
} from "../utils";
import chalk from "chalk";

export type MetaCliArgs = [string];

export interface MetaCliOptions extends SpotiCliOptions {}

export default new Command()
  .name("meta")
  .description("Retrieve metadata for a Spotify URL")
  .argument("<url>", "A Spotify URL to retrieve metadata for")
  .allowUnknownOption(true)
  .action(
    createActionHandler<MetaCliArgs, MetaCliOptions>(async (url, options) => {
      validateSpotifyURL(url);

      const { type, id } = parseSpotifyURL(url);

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
    })
  );
