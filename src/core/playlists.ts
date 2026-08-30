import { type Spotify } from "../models";
import { SpotifyApi } from "../services";
import { type SpotiOptions } from "../types/config";
import { type SpotifySearchResult } from "../types/spotify";
import { Progress } from "../utils/progress";
import { searchYoutubeSongs } from "../utils/search";
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

  const progress = new Progress({
    label: "Processing…",
    total: total * 3,
    color: chalk.blue,
  });

  /* #region Fetches */
  const fetches: Promise<void>[] = [];

  const fetching = new Progress({
    label: "Fetching Spotify tracks…",
    total,
    color: chalk.yellow,
    subscribers: [(payload) => progress.subscribe(payload)],
  });

  fetching.increment();

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
        fetching.increment();
      })()
    );
  }

  await Promise.all(fetches);

  fetching.done();
  /* #endregion */

  // @TODO Look for existing metadata file for playlist ID
  // If metadata file exists, read contents & hydrate existing track ID search results
  // Then, only search for remaining items still missing search result

  /* #region Searches */
  const searches: Promise<void>[] = [];

  const searching = new Progress({
    label: "Searching Youtube songs…",
    total,
    color: chalk.yellow,
    subscribers: [(payload) => progress.subscribe(payload)],
  });

  for (const group of results) {
    searches.push(
      (async () => {
        await searchYoutubeSongs(group, options, () => searching.increment());
      })()
    );
  }

  await Promise.all(searches);

  searching.done();
  /* #endregion */

  // @TODO Find third-party service for collection audio feature data
  // @TODO Save new metadata file for the playlist ID

  progress.done();

  console.log();

  return results.flat();
}
