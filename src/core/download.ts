import { type ActionHandler } from "../types/action";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Audio } from "../utils/audio";
import { Spoti } from "../utils/spoti";
import { parseSpotifyURL } from "../utils/spotify";
import chalk from "chalk";

export type DownloadArguments = [string];

export interface DownloadOptions extends SpotiOptions {
  cache: boolean;
  force: boolean;
  format: AudioFormat;
  prefixes: boolean;
  suffixes: boolean;
}

const DOWNLOAD_DEFAULTS: DownloadOptions = {
  cache: true,
  force: false,
  format: Audio.DEFAULT_FORMAT,
  verbose: false,
  prefixes: true,
  suffixes: true,
};

export const download: ActionHandler<
  DownloadArguments,
  DownloadOptions
> = async <TOptions extends DownloadOptions>(
  url: string,
  config?: TOptions
) => {
  const options = mergeOptions(DOWNLOAD_DEFAULTS, config);
  const { type, id } = parseSpotifyURL(url);

  console.log(`Downloading ${chalk.magenta(type)} (${chalk.blue(id)})…`);
  console.log("");

  if (options.verbose) {
    console.log(chalk.bold.dim("Data"));
    console.log({ type, id });
    console.log("");
  }

  await Spoti.download(id, type, options);
};
