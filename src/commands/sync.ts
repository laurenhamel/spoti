import { Command } from "commander";
import { AudioFormat, type SpotiCliOptions } from "../types";
import { Metadata, Spoti } from "../core";
import {
  Audio,
  parseSpotifyURL,
  isSpotifyURL,
  createActionHandler,
} from "../utils";

export type SyncCliArgs = [string, string?];

export interface SyncCliOptions extends SpotiCliOptions {
  cache: boolean;
  format: AudioFormat;
  init: boolean;
  prefixes: boolean;
  suffixes: boolean;
}

export default new Command()
  .name("sync")
  .description("Sync tracks from a Spotify URL to your local directory")
  .argument("<query>", "A metadata filename or a Spotify URL to start syncing")
  .argument("[file]", "The metadata filename to output")
  .option("-f, --format", "The output audio file format", Audio.DEFAULT_FORMAT)
  .option("-i, --init", "Initialize metadata file only", false)
  .option("--no-cache", "Disables using cached search results")
  .option("--no-prefixes", "Disallow prefixes in file names")
  .option("--no-suffixes", "Disallolw suffixes in file names")
  .allowUnknownOption(true)
  .action(
    createActionHandler<SyncCliArgs, SyncCliOptions>(
      async (query, file, options) => {
        if (isSpotifyURL(query)) {
          const { type, id } = parseSpotifyURL(query);
          const name = file ?? id;

          if (Metadata.has(name)) {
            const metadata = Metadata.file(name);

            throw new Error(
              [
                `A metadata file named '${metadata}' already exists.`,
                `Use 'spoti sync ${name}' instead.`,
              ].join("\n")
            );
          }

          const data = { type, id, url: query };

          Metadata.save(name, data);

          !options.init && (await Spoti.download(id, type, options));
        } else {
          if (!Metadata.has(query)) {
            const metadata = Metadata.file(query);

            throw new Error(
              [
                `A metadata file named '${metadata}' does not exist.`,
                `Try 'spoti sync <url> ${query}' instead.`,
              ].join("\n")
            );
          }

          const data = Metadata.read(query);

          const { type, id } = data as ReturnType<typeof parseSpotifyURL>;

          await Spoti.download(id, type, options);

          Metadata.save(query, data);
        }
      }
    )
  );
