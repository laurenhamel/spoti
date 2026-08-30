import { Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { parseSpotifyURL, getSpotifyType } from "../utils/spotify";
import { stringifyType } from "../utils/stringify";
import chalk from "chalk";
import { type Primitive } from "type-fest";

export type InfoArguments = [string];

export interface InfoOptions extends SpotiOptions {}

export const INFO_DEFAULTS: InfoOptions = {
  verbose: false,
};

export const info: ActionHandler<InfoArguments, InfoOptions> = async <
  TOptions extends InfoOptions,
>(
  url: string,
  config?: TOptions
) => {
  const options = mergeOptions(INFO_DEFAULTS, config);
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
};
