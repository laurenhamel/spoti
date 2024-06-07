import { Command } from "commander";

export default new Command()
  .name("sync")
  .description("Sync tracks from a Spotify URL to your local directory")
  .argument(
    "<query>",
    "Either an existing metadata file created from a previous sync or the initial Spotify URL to start syncing"
  )
  .argument(
    "[file]",
    "A metadata filename to output to when the <query> is a Spotify URL"
  )
  .action((...args) => {
    console.log("Sync", ...args);
  });
