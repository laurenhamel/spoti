import { search, type SearchArguments, type SearchOptions } from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export interface SearchCliOptions extends SearchOptions {}

export default new Command()
  .name("search")
  .description("Searches tracks in a given Spotify URL on YouTube")
  .argument("<url>", "A Spotify URL with tracks to search for on YouTube")
  .option("--no-cache", "Disables using cached search results")
  .action(
    createAction<SearchArguments, SearchCliOptions>(search<SearchCliOptions>)
  );
