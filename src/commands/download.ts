import { Spoti } from "../core/spoti";
import { type AudioFormat } from "../types/audio";
import { type SpotiCliOptions } from "../types/config";
import { createActionHandler } from "../utils/action";
import { Audio } from "../utils/audio";
import { parseSpotifyURL, validateSpotifyURL } from "../utils/spotify";
import chalk from "chalk";
import { Command } from "commander";

export type DownloadCliArgs = [string];

export interface DownloadCliOptions extends SpotiCliOptions {
  cache: boolean;
  format: AudioFormat;
  prefixes: boolean;
  suffixes: boolean;
}

export default new Command()
  .name("download")
  .description("Download tracks from a Spotify URL")
  .argument("<url>", "A Spotify URL to download tracks from")
  .option("--force", "Force download and overwrite existing files", false)
  .option("-f, --format", "The output audio file format", Audio.DEFAULT_FORMAT)
  .option("--no-cache", "Disables using cached search results")
  .option("--no-prefixes", "Disallow prefixes in file names")
  .option("--no-suffixes", "Disallow suffixes in file names")
  .action(
    createActionHandler<DownloadCliArgs, DownloadCliOptions>(
      async (url, options) => {
        validateSpotifyURL(url);

        const { type, id } = parseSpotifyURL(url);

        console.log(`Downloading ${chalk.magenta(type)} (${chalk.blue(id)})…`);
        console.log("");

        if (options.verbose) {
          console.log(chalk.bold.dim("Data"));
          console.log({ type, id });
          console.log("");
        }

        await Spoti.download(id, type, options);
      }
    )
  );
