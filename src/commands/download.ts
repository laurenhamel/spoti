import { Command } from "@commander-js/extra-typings";

export default new Command()
  .name("download")
  .description("Download tracks from a Spotify URL")
  .argument("<url>", "A Spotify URL to download tracks from")
  .action((...args) => {
    console.log("Download", ...args);
  });
