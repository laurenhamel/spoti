/** @see {@link https://github.com/yt-dlp/yt-dlp#usage-and-options} */

export interface YtdlpOptions
  extends YtdlpNetworkOptions, YtdlpDownloadOptions, YtdlpFilesystemOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  /**
   * A list of locations to look for configuration files
   */
  configLocations?: string;
  /**
   * A list of directory to look for `yt-dlp` plugins
   */
  pluginDirs?: string;
  /**
   * Silences logging
   * @defaultValue false
   */
  quiet?: boolean;
  /**
   * Ignores warnings
   * @defaultValue false
   */
  warnings?: boolean;
  /**
   * Performs a dry run without downloading or writing anything to disk
   * @defaultValue false
   */
  simulate?: boolean;
  /**
   * Toggles the display of the progress bar.
   * @remarks Enabling this shows the progress bar even in quiet mode.
   * @defaultValue undefined
   */
  progress?: boolean;
  /**
   * Prints more debugging information
   * @defaultValue false
   */
  verbose?: boolean;
  /**
   * Displays HTTP request traffic
   * @defaultValue false
   */
  printTraffic?: boolean;
}

export interface YtdlpNetworkOptions {
  /**
   * Forces strictly ipv4 requests
   */
  forceIpv4?: boolean;
  /**
   * Forces strictly ipv6 requests
   */
  forceIpv6?: boolean;
}

export interface YtdlpDownloadOptions {
  /**
   * Number of fragments to download concurrently (dash/hls)
   * @defaultValue 1
   * */
  concurrentFragments?: number;
  /**
   * Maximum download rate in bytes per second
   */
  limitRate?: number | `${number}${"K" | "M"}`;
  /**
   * Minimum download rate in bytes per second
   */
  throttledRate?: number | `${number}${"K" | "M"}`;
  /**
   * Number of retries
   * @defaultValue 10
   */
  retries?: number | "infinite";
  /**
   * Number of retries on file access errors
   * @defaultValue 3
   */
  fileAccessRetries?: number | "infinite";
  /**
   * Number of retries per fragment (dash, hls, ism)
   * @defaultValue 10
   */
  fragmentRetries?: number | "infinite";
  /**
   * Time to sleep between retries (seconds)
   */
  retrySleep?:
    number | `${"http" | "fragment" | "file_access" | "extractor"}:${number}`[];
  /**
   * Size of download buffer
   */
  bufferSize?: number | `${number}${"K" | "M"}`;
}

export interface YtdlpFilesystemOptions {
  /**
   * Do not overwrite any files
   * @defaultValue false
   */
  noOverwrites?: boolean;
  /**
   * Force overwrite all download and metadata files.
   * @remarks Only metadata files are overwritten by default.
   * @defaultValue false
   */
  forceOverwrites?: boolean;
  /**
   * Resumes partially downloaded files.
   * @remarks Fully restarts downloads for non-fragmented files.
   * @defaultValue true
   */
  continue?: boolean;
  /**
   * Uses `*.part` files instead of writing directly to an output file path
   * @defaultValue true
   */
  part?: boolean;
  /**
   * Use the 'Last-modified' header to set files' last modified times
   * @defaultValue false
   */
  mtime?: boolean;
  /**
   * Directory for `yt-dlp` to cache download info
   * @defaultValue "${XDG_CACHE_HOME}/yt-dlp"
   */
  cacheDir?: string | false;
}
