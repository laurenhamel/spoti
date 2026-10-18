export interface SpotiOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  verbose: boolean;
}

export interface SpotiConfiguration extends Partial<SpotiOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  debug?: boolean;
  spotify?: SpotiSpotifyConfiguration;
  youtube?: SpotiYoutubeConfiguration;
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
