import { info, type InfoArguments, type InfoOptions } from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export interface InfoCliOptions extends InfoOptions {}

export default new Command()
  .name("info")
  .description("Retrieve information about a Spotify URL")
  .argument("<url>", "A Spotify URL to retrieve information for")
  .action(createAction<InfoArguments, InfoCliOptions>(info<InfoCliOptions>));
