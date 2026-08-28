import { type Spotify } from "../models";
import { SpotifyApi } from "../services";
import { type SpotiOptions } from "../types/config";
import { type SpotifySearchResult } from "../types/spotify";
import { Progress } from "../utils/progress";
import { hydrateSpotifyFeatures } from "./features";
import { hydrateYoutubeSearch } from "./search";
import chalk from "chalk";

export async function getSpotifyPlaylist<TOptions extends SpotiOptions>(
  model: Spotify.Playlist,
  options?: TOptions
): Promise<SpotifySearchResult[]> {
  const { id, items: tracks } = model;
  const { total, items, limit } = tracks;
  const iterations = Math.ceil(total / limit) - 1;
  const results: SpotifySearchResult[][] = [items as SpotifySearchResult[]];

  console.log();
  console.log(`Found ${chalk.cyan(total)} total tracks.`);
  console.log();

  const progress$ = new Progress(
    "Processing…",
    {
      type: "percentage",
      percentage: 0,
      nameTransformFn: chalk.blue,
    },
    (() => {
      let reports = 0;

      return (amount: number = limit): void => {
        reports += amount;
        const percentage = reports / (total * 3);
        progress$.update(percentage);
      };
    })()
  );

  /* #region Fetches */
  const fetches: Promise<void>[] = [];

  const fetches$ = new Progress(
    "Fetching Spotify tracks…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${total}`,
      nameTransformFn: chalk.yellow,
    },
    (() => {
      let reports = 0;

      return (amount = limit): void => {
        reports += amount;
        const percentage = reports / total;
        const message = `${reports} / ${total}`;
        fetches$.update(percentage, message);
        progress$.report(amount);
      };
    })()
  );

  fetches$.report();

  for (let i = 1; i <= iterations; i++) {
    const offset = i * limit;

    fetches.push(
      (async () => {
        const payload = { id, offset, limit };
        const tracks = await SpotifyApi.getPlaylistItems<Spotify.Tracks>(
          payload,
          options
        );

        results.push(tracks.items as SpotifySearchResult[]);
        fetches$.report();
      })()
    );
  }

  await Promise.all(fetches);

  fetches$.done();
  /* #endregion */

  // @TODO Look for existing metadata file for playlist ID
  // If metadata file exists, read contents & hydrate existing track ID search results
  // Then, only search for remaning items still missing search result

  /* #region Searches */
  const searches: Promise<void>[] = [];

  const searches$ = new Progress(
    "Searching Youtube songs…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${total}`,
      nameTransformFn: chalk.yellow,
    },
    (() => {
      let reports = 0;

      return (amount = limit): void => {
        reports += amount;
        const percentage = reports / total;
        const message = `${reports} / ${total}`;
        searches$.update(percentage, message);
        progress$.report(amount);
      };
    })()
  );

  const increment = () => searches$.report(1);

  for (const group of results) {
    searches.push(
      (async () => {
        await hydrateYoutubeSearch(group, options, increment);
      })()
    );
  }

  await Promise.all(searches);

  searches$.done();
  /* #endregion */

  // @TODO Try to use existing audio features from metadata file here

  /* #region Features */
  const features: Promise<void>[] = [];

  const features$ = new Progress(
    "Gathering audio features…",
    {
      type: "percentage",
      percentage: 0,
      message: `0 / ${total}`,
      nameTransformFn: chalk.yellow,
    },
    (() => {
      let reports = 0;

      return (amount = limit): void => {
        reports += amount;
        const percentage = reports / total;
        const message = `${reports} / ${total}`;
        features$.update(percentage, message);
        progress$.report(amount);
      };
    })()
  );

  for (const group of results) {
    features.push(
      (async () => {
        await hydrateSpotifyFeatures(group, options);
        features$.report();
      })()
    );
  }

  await Promise.all(features);

  features$.done();
  /* #endregion */

  // @TODO Save new metadata file for the playlist ID

  progress$.done();

  console.log();

  return results.flat();
}
