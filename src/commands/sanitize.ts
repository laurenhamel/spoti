import {
  sanitize,
  type SanitizeArguments,
  type SanitizeOptions,
} from "../core";
import { createAction } from "../utils/action";
import { Command } from "commander";

export interface SanitizeCliOptions extends SanitizeOptions {}

export default new Command()
  .name("sanitize")
  .description("Sanitizes files in your library")
  .argument("[file]", "An MP3 file or Spoti metadata file")
  .option("--clean", "Clean temporary files instead of sanitizing them")
  .option("--dry", "Perform a dry run without making changes")
  .option("--no-cache", "Disables using cached search results")
  .action(
    createAction<SanitizeArguments, SanitizeCliOptions>(
      sanitize<SanitizeCliOptions>
    )
  );
