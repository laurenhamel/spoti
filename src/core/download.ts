import { Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Audio, convertAudioFiles } from "../utils/audio";
import {
  downloadSpotifyTracks,
  prepareDownloadTargets,
} from "../utils/downloads";
import { searchYoutubeType } from "../utils/search";
import { parseSpotifyURL, getSpotifyType } from "../utils/spotify";
import { addTrackTags } from "../utils/tags";
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

  if (![Spotify.Type.PLAYLIST, Spotify.Type.TRACK].includes(type)) {
    throw new Error(
      `Sorry, retrieving information for ${type}s not yet supported.`
    );
  }

  console.log(`Downloading ${chalk.magenta(type)} (${chalk.blue(id)})…`);

  if (options.verbose) {
    console.log();
    console.log(chalk.bold.dim("Data"));
    console.log({ type, id });
    console.log();
  }

  const data = await getSpotifyType(id, type, options);
  const results = await searchYoutubeType(type, data, options);
  const targets = prepareDownloadTargets(type, data, results, options);
  const downloads = await downloadSpotifyTracks(targets, options);
  await convertAudioFiles(downloads, options);
  await addTrackTags(downloads, options);
};
