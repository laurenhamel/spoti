import { sync, type SyncArguments, type SyncOptions } from "../core";
import { createAction } from "../utils/action";
import { Audio } from "../utils/audio";
import { Command } from "commander";

export default new Command()
  .name("sync")
  .description("Sync tracks from a Spotify URL to your local directory")
  .argument("<query>", "A metadata filename or a Spotify URL to start syncing")
  .argument("[file]", "The metadata filename to output")
  .option("--force", "Force download and overwrite existing files", false)
  .option("-f, --format", "The output audio file format", Audio.DEFAULT_FORMAT)
  .option("--init", "Initialize metadata file only", false)
  .option("--no-cache", "Disables using cached search results")
  .option("--no-prefixes", "Disallow prefixes in file names")
  .option("--no-suffixes", "Disallow suffixes in file names")
  .action(createAction<SyncArguments, SyncOptions>(sync));
