import { Spotify } from "../models";
import chalk from "chalk";
import { SpotifyApi } from "../services";
import { type SpotiOptions, type SpotifySearchResult } from "../types";
import { Progress } from "../utils";
import { hydrateSpotifyFeatures } from "./features";
import { hydrateYoutubeSearch } from "./search";

export async function getSpotifyPlaylist<TOptions extends SpotiOptions>(
  model: Spotify.Playlist,
  options?: TOptions
): Promise<SpotifySearchResult[]> {
  const { id, tracks } = model;
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

      return (amount = limit): void => {
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
      new Promise<void>(async (resolve) => {
        const payload = { id, offset, limit };
        const tracks = await SpotifyApi.getPlaylistTracks<Spotify.Tracks>(
          payload,
          options
        );

        results.push(tracks.items as SpotifySearchResult[]);
        fetches$.report();
        resolve();
      })
    );
  }

  await Promise.all(fetches);

  fetches$.done();
  fetches$.remove();
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
      new Promise<void>(async (resolve) => {
        await hydrateYoutubeSearch(group, options, increment);
        resolve();
      })
    );
  }

  await Promise.all(searches);

  searches$.done();
  searches$.remove();
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
      new Promise<void>(async (resolve) => {
        await hydrateSpotifyFeatures(group, options);
        features$.report();
        resolve();
      })
    );
  }

  await Promise.all(features);

  features$.done();
  features$.remove();
  /* #endregion */

  // @TODO Save new metadata file for the playlist ID

  progress$.done();
  progress$.remove();

  console.log();

  return results.flat();
}
