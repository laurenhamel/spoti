import { type ActionHandler } from "../types/action";
import { type AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import { mergeOptions } from "../utils/action";
import { Audio } from "../utils/audio";
import { Metadata } from "../utils/metadata";
import { Spoti } from "../utils/spoti";
import { isSpotifyURL, parseSpotifyURL } from "../utils/spotify";

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
};
