/* eslint-disable @typescript-eslint/no-explicit-any */
import { type CamelCase, type PascalCase } from "type-fest";

export interface SpotiOptions {
  [key: string]: any;

  /**
   * Whether to output more information to the console
   */
  verbose: boolean;
}

export interface SpotiConfiguration extends Partial<SpotiOptions> {
  [key: string]: any;

  /**
   * Whether to output debugging information
   * @defaultValue false
   */
  debug?: boolean;
  /**
   * Whether to display progress bars during Spoti operations
   * @defaultValue true
   */
  progress?: boolean;

  tags?: SpotiTagsConfiguration;
  spotify?: SpotiSpotifyConfiguration;
  youtube?: SpotiYoutubeConfiguration;
  lastfm?: SpotiLastfmConfiguration;
  musicbrainz?: SpotiMusicbrainzConfiguration;
  plugins?: SpotiPluginsConfiguration;
}

export interface SpotiPluginsConfiguration {
  [scope: `com.spoti.${CamelCase<string> | PascalCase<string>}`]: any;
}

export interface SpotiTagsConfiguration {
  /**
   * The delimiter used between multiple genre tags
   * @defaultValue ';'
   */
  genreDelimiter?: string;
}

export interface SpotiSpotifyConfiguration {
  /**
   * Credentials for the Spotify API
   */
  api?: {
    key?: string;
    secret?: string;
  };
}

export interface SpotiYoutubeConfiguration {
  /**
   * Credentials for the YouTube API
   */
  api?: {
    key?: string;
  };
}

export interface SpotiLastfmConfiguration {
  /**
   * Whether Last.fm should be used as a source for tag data
   * @defaultValue true
   */
  enabled?: boolean;
  /**
   * Credentials for the Last.fm API
   */
  api?: {
    key?: string;
    secret?: string;
  };
}

export interface SpotiMusicbrainzConfiguration {
  /**
   * Whether MusicBrainz should be used as a source for tag data
   * @remarks Requires Last.fm also be enabled for sourcing MusicBrainz IDs.
   * @defaultValue true
   */
  enabled?: boolean;
  /**
   * The minimum number of votes a genre must have to be included in tags
   * @defaultValue 3
   */
  genreThreshold?: number;
}

export enum SpotiConfigurationSource {
  /**
   * Spoti defaults
   */
  DEFAULTS = "defaults",
  /**
   * Environment variables
   */
  ENV = "env",
  /**
   * CLI defaults,
   */
  CLI_DEFAULTS = "cli:defaults",
  /**
   * CLI options,
   */
  CLI_OPTIONS = "cli:options",
  /**
   * User-defined
   */
  USER = "user",
}

export interface SpotiConfigurationLayer<
  TConfiguration extends SpotiConfiguration,
> {
  source: SpotiConfigurationSource;
  data: TConfiguration;
}
