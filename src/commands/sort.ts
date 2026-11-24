import { sort, type SortOptions, type SortArguments } from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export default new Command()
  .name("sort")
  .description("Sorts library files using the given file/folder format")
  .argument("<format>", "The desired file/folder format")
  .argument("[file]", "An audio file or Spoti metadata file")
  .option("--dry", "Perform a dry run without making changes")
  .option("--no-cache", "Disables using cached search results")
  .action(createAction<SortArguments, SortOptions>(sort));
