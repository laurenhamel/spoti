import { searchYoutubeType } from "../core/search";
import { getSpotifyType } from "../core/spotify";
import { stringifySearch } from "../core/stringify";
import { Spotify } from "../models";
import { type SpotiCliOptions } from "../types/config";
import { createActionHandler } from "../utils/action";
import { parseSpotifyURL, validateSpotifyURL } from "../utils/spotify";
import chalk from "chalk";
import { Command } from "commander";
import { type Primitive } from "type-fest";

export type SearchCliArgs = [string];

export interface SearchCliOptions extends SpotiCliOptions {
  cache: boolean;
}

export default new Command()
  .name("search")
  .description("Searches tracks in a given Spotify URL on YouTube")
  .argument("<url>", "A Spotify URL with tracks to search for on YouTube")
  .option("--no-cache", "Disables using cached search results")
  .action(
    createActionHandler<SearchCliArgs, SearchCliOptions>(
      async (url, options) => {
        validateSpotifyURL(url);

        const { type, id } = parseSpotifyURL(url);

        console.log(
          `Searching for ${chalk.magenta(type)} (${chalk.blue(id)})…`
        );

        if (options.verbose) {
          console.log();
          console.log(chalk.bold.dim("Data"));
          console.log({ type, id });
          console.log();
        }

        const data = await getSpotifyType(id, type, options);
        const results = await searchYoutubeType(type, data, options);
        const details: Record<string, Primitive> = {};
        const info = stringifySearch(type, data, results, options, details);

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
      }
    )
  );
