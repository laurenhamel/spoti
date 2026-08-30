import { getSpotifyType } from "../core/spotify";
import { stringifyType } from "../core/stringify";
import { Spotify } from "../models";
import { type SpotiCliOptions } from "../types/config";
import { createActionHandler } from "../utils/action";
import { parseSpotifyURL, validateSpotifyURL } from "../utils/spotify";
import chalk from "chalk";
import { Command } from "commander";
import { type Primitive } from "type-fest";

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
      const details: Record<string, Primitive> = {};
      const info = stringifyType(type, data, options, details);

      switch (type) {
        case Spotify.Type.PLAYLIST:
        case Spotify.Type.TRACK: {
          console.log();
          console.log(info);
          break;
        }
        default: {
          throw new Error(
            `Sorry, retrieving information for ${type}s not yet supported.`
          );
        }
      }
    })
  );
