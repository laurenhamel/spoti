import { Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Audio, convertAudioFiles } from "../utils/audio";
import { reportStatuses, reportErrors } from "../utils/console";
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
  convert: boolean;
  force: boolean;
  format: AudioFormat;
  prefixes: boolean;
  suffixes: boolean;
  tag: boolean;
}

const DOWNLOAD_DEFAULTS: DownloadOptions = {
  cache: true,
  convert: true,
  force: false,
  format: Audio.DEFAULT_FORMAT,
  verbose: false,
  prefixes: true,
  suffixes: true,
  tag: true,
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
    throw new Error(`Sorry, downloading for ${type}s not yet supported.`);
  }

  console.log(`Downloading ${chalk.magenta(type)} (${chalk.blue(id)})…`);

  const data = await getSpotifyType(id, type, options);
  const results = await searchYoutubeType(type, data, options);
  const targets = prepareDownloadTargets(type, data, results, options);
  const downloads = await downloadSpotifyTracks(targets, options);
  // prettier-ignore
  const conversions = options.convert ? await convertAudioFiles(downloads, options) : null;
  const tags = options.tag ? await addTrackTags(downloads, options) : null;

  reportStatuses("Downloaded", downloads);
  conversions && reportStatuses("Converted", conversions);
  tags && reportStatuses("Tagged", tags);

  if (options?.verbose) {
    reportErrors(downloads as { error?: Error }[]);
    conversions && reportErrors(conversions as { error?: Error }[]);
    tags && reportErrors(tags as { error?: Error }[]);
  }

  console.log("");
  console.log(chalk.blue("See above for details!"));
};
