import { Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { searchYoutubeType } from "../utils/search";
import { parseSpotifyURL, getSpotifyType } from "../utils/spotify";
import { stringifySearch } from "../utils/stringify";
import chalk from "chalk";
import { type Primitive } from "type-fest";

export type SearchArguments = [string];

export interface SearchOptions extends SpotiOptions {
  cache: boolean;
}

const SEARCH_DEFAULTS: SearchOptions = {
  cache: true,
  verbose: false,
};

export const search: ActionHandler<SearchArguments, SearchOptions> = async <
  TOptions extends SearchOptions,
>(
  url: string,
  config?: TOptions
) => {
  const options = mergeOptions(SEARCH_DEFAULTS, config);
  const { type, id } = parseSpotifyURL(url);

  console.log(`Searching for ${chalk.magenta(type)} (${chalk.blue(id)})…`);

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
};
