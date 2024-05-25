import { Command } from "@commander-js/extra-typings";

export default new Command()
  .name("meta")
  .description("Retrieve metadata for a Spotify URL")
  .argument("<url>", "A Spotify URL to retrieve metadata for")
  .action((...args) => {
    console.log("Meta", ...args);
  });
