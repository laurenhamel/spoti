import { Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { type SpotiMetadata } from "../types/metadata";
import { mergeOptions } from "../utils/action";
import { Audio } from "../utils/audio";
import { Metadata } from "../utils/metadata";
import { isSpotifyURL, parseSpotifyURL } from "../utils/spotify";
import { download } from "./download";

export type SyncArguments = [string, string?];

export interface SyncOptions extends SpotiOptions {
  cache: boolean;
  force: boolean;
  format: AudioFormat;
  init: boolean;
  prefixes: boolean;
  suffixes: boolean;
}

const SYNC_DEFAULTS: SyncOptions = {
  cache: true,
  force: false,
  format: Audio.DEFAULT_FORMAT,
  init: false,
  verbose: false,
  prefixes: true,
  suffixes: true,
};

export const sync: ActionHandler<SyncArguments, SyncOptions> = async <
  TOptions extends SyncOptions,
>(
  query: string,
  file?: string,
  config?: TOptions
) => {
  const options = mergeOptions(SYNC_DEFAULTS, config);

  // URL provided
  if (isSpotifyURL(query)) {
    const { type, id } = parseSpotifyURL(query);

    if (![Spotify.Type.PLAYLIST, Spotify.Type.TRACK].includes(type)) {
      throw new Error(`Sorry, syncing for ${type}s not yet supported.`);
    }

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

    const metadata: SpotiMetadata = { type, id, url: query };

    Metadata.save(name, metadata);

    !options.init && (await download(query, options));
  }

  // URL missing
  else {
    if (!Metadata.has(query)) {
      const metadata = Metadata.file(query);

      throw new Error(
        [
          `A metadata file named '${metadata}' does not exist.`,
          `Try 'spoti sync <url> ${query}' instead.`,
        ].join("\n")
      );
    }

    const metadata = Metadata.read(query);

    await download(metadata.url, options);

    Metadata.save(query, metadata);
  }
};
