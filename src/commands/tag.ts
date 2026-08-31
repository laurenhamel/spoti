import { tag, type TagOptions, type TagArguments } from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export interface TagCliOptions extends TagOptions {}

export default new Command()
  .name("tag")
  .description("Update ID3 tags of your music library")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("--dry", "Perform a dry run without making changes")
  .option("--no-cache", "Disables using cached search results")
  .action(createAction<TagArguments, TagCliOptions>(tag<TagCliOptions>));
