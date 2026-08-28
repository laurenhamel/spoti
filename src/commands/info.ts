import { getSpotifyType } from "../core/spotify";
import { type SpotiCliOptions } from "../types/config";
import { createActionHandler } from "../utils/action";
import { parseSpotifyURL, validateSpotifyURL } from "../utils/spotify";
import chalk from "chalk";
import { Command } from "commander";

export type InfoCliArgs = [string];

export interface InfoCliOptions extends SpotiCliOptions {}

export default new Command()
  .name("info")
  .description("Retrieve information about a Spotify URL")
  .argument("<url>", "A Spotify URL to retrieve information for")
  .action(
    createActionHandler<InfoCliArgs, InfoCliOptions>(async (url, options) => {
      validateSpotifyURL(url);

      const { type, id } = parseSpotifyURL(url);

      console.log(
        `Retrieving information for ${chalk.magenta(type)} (${chalk.blue(id)})…`
      );

      if (options.verbose) {
        console.log();
        console.log(chalk.bold.dim("Data"));
        console.log({ type, id });
        console.log();
      }

      const data = await getSpotifyType(id, type, options);

      console.log(data);

      switch (type) {
        default: {
          throw new Error(
            `Sorry, retrieving information for ${type}s not yet supported.`
          );
        }
      }
    })
  );
