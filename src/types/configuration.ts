/* eslint-disable @typescript-eslint/no-explicit-any */
import { type CamelCase, type PascalCase } from "type-fest";

export interface SpotiOptions {
  [key: string]: any;

  verbose: boolean;
}

export interface SpotiConfiguration extends Partial<SpotiOptions> {
  [key: string]: any;

  /** @defaultValue false */
  debug?: boolean;
  /** @defaultValue true */
  progress?: boolean;

  tags?: SpotiTagsConfiguration;
  spotify?: SpotiSpotifyConfiguration;
  youtube?: SpotiYoutubeConfiguration;
  lastfm?: SpotiLastfmConfiguration;
  plugins?: SpotiPluginsConfiguration;
}

export interface SpotiPluginsConfiguration {
  [scope: `com.spoti.${CamelCase<string> | PascalCase<string>}`]: any;
}

export interface SpotiTagsConfiguration {
  /** @defaultValue ';' */
  genreDelimiter?: string;
}

export interface SpotiSpotifyConfiguration {
  api?: {
    key?: string;
    secret?: string;
  };
}

export interface SpotiYoutubeConfiguration {
  api?: {
    key?: string;
  };
}

export interface SpotiLastfmConfiguration {
  api?: {
    key?: string;
    secret?: string;
  };
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
