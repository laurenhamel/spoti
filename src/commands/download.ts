import {
  type DownloadArguments,
  type DownloadOptions,
  download,
} from "../core";
import { createAction } from "../utils/action";
import { Audio } from "../utils/audio";
import { Command } from "commander";

export default new Command()
  .name("download")
  .description("Download tracks from a Spotify URL")
  .argument("<url>", "A Spotify URL to download tracks from")
  .option("--force", "Force download and overwrite existing files", false)
  .option("-f, --format", "The output audio file format", Audio.DEFAULT_FORMAT)
  .option("--no-cache", "Disables using cached search results")
  .option("--no-convert", "Skips 'ffmpeg' file conversions after downloading")
  .option("--no-tag", "Skips ID3 tagging after downloading")
  .option("--no-prefixes", "Disallow prefixes in file names")
  .option("--no-suffixes", "Disallow suffixes in file names")
  .action(createAction<DownloadArguments, DownloadOptions>(download));
