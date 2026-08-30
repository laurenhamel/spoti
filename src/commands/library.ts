import { library, type LibraryArguments, type LibraryOptions } from "../core/library";
import { createAction } from "../utils/action";
import { Command } from "commander";

export interface LibraryCliOptions extends LibraryOptions {}

export default new Command()
  .name("library")
  .description("Retrieve information about your music library")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("-m, --more", "Output more data (ID3 tags and duration)", false)
  .action(
    createAction<LibraryArguments, LibraryCliOptions>(
      library<LibraryCliOptions>
    )
  );
