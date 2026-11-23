import { rename, type RenameOptions, type RenameArguments } from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export default new Command()
  .name("rename")
  .description("Renames library files to use the Spoti format w/ Spotify track info")
  .argument("[file]", "An audio file or Spoti metadata file")
  .option("--dry", "Perform a dry run without making changes")
  .option("--no-cache", "Disables using cached search results")
  .action(createAction<RenameArguments, RenameOptions>(rename));
