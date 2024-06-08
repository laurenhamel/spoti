import { Command } from "commander";
import { Spotify } from "../models";
import {
  getSpotifyType,
  getSpotifyPlaylist,
  downloadSpotifyTracks,
} from "../core";
import { type SpotiCliOptions } from "../types";
import {
  parseSpotifyURL,
  validateSpotifyURL,
  createActionHandler,
  Library,
} from "../utils";
import chalk from "chalk";
import { map } from "lodash-es";

export type DownloadCliArgs = [string];

export interface DownloadCliOptions extends SpotiCliOptions {}

export default new Command()
  .name("download")
  .description("Download tracks from a Spotify URL")
  .argument("<url>", "A Spotify URL to download tracks from")
  .allowUnknownOption(true)
  .action(
    createActionHandler<DownloadCliArgs, DownloadCliOptions>(
      async (url, options) => {
        await Library.ready();

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
          case Spotify.Type.PLAYLIST: {
            const model = meta as Spotify.Playlist;
            const tracks = await getSpotifyPlaylist(model, options);
            const { passed, failed } = await downloadSpotifyTracks(
              tracks,
              options
            );
            console.log();
            console.log(`Results:`);
            console.log(
              chalk.green("✓") + ` ${passed} track(s) downloaded successfully.`
            );

            if (failed.length) {
              console.log(
                chalk.red("𐄂") + ` ${failed} track(s) could not be downloaded.`
              );
              options?.verbose &&
                console.log("\n" + map(failed, "error.message").join("\n"));
            }

            console.log();
            console.log("See above for details!");
            console.log();

            break;
          }
          default: {
            throw new Error(`Sorry, downloading ${type}s not yet supported.`);
          }
        }
      }
    )
  );
