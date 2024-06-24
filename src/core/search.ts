import { Spotify, Youtube } from "../models";
import { YoutubeApi } from "../services";
import {
  SpotifySearchResult,
  type SpotiOptions,
  type YoutubeSearchResult,
} from "../types";
import { cache, pool } from "../utils";
import { find, map, sum } from "lodash-es";
import Fuse from "fuse.js";

export function findBestSearchResult<TOptions extends SpotiOptions>(
  songs: Youtube.Song[],
  item: Spotify.Item,
  options?: TOptions
): Youtube.Song {
  interface PreparedSearchResult {
    song: Youtube.Song;
    title: string;
    artists: string;
    duration: number;
    index: number;
  }

  const prepared = map<Youtube.Song, PreparedSearchResult>(
    songs,
    (song, index) => {
      const title = song?.title as string;
      const artists = map(song?.artists as { name: string }[], "name").join(
        ", "
      );
      const duration = (song.duration?.seconds as number) * 1000;

      return {
        song,
        title,
        duration,
        artists,
        index,
      };
    }
  );

  /**
   * Yields a decimal between 0-1 of similarity in duration for each item, where 0 = exact match.
   * @param items - The items to compare
   * @param buffer - The amount of leeway in ms allowed within duration
   * @returns
   */
  const compareDurations = (
    items: PreparedSearchResult[],
    buffer = 10000 // 10s
  ): number[] => {
    return map(items, ({ duration: b }) => {
      const a = item.track.duration_ms;
      const [min, max] = [a - buffer, a + buffer];
      return 1 - (b >= min ? 0.5 : 0) - (b <= max ? 0.5 : 0);
    });
  };

  /**
   * Yields a decimal between 0-1 of similarity of the track's titles for each item, where 0 = exact match.
   * @param items - The items to compare
   * @param threshold - The search threshold to use
   * @returns
   */
  const compareTitles = (
    items: PreparedSearchResult[],
    threshold = 0.6
  ): number[] => {
    const title = item.track.name;

    const fuse = new Fuse(items, {
      isCaseSensitive: false,
      includeScore: true,
      shouldSort: false,
      threshold,
      keys: ["title"],
    });

    const results = fuse.search(title);

    return map(items, ({ index }) => {
      const result = find(results, ["item.index", index]);
      return result?.score ?? 1;
    });
  };

  /**
   * Yields a decimal between 0-1 of similarity of the track's artists for each item, where 0 = exact match.
   * @param items - The items to compare
   * @param threshold - The search threshold to use
   * @returns
   */
  const compareArtists = (
    items: PreparedSearchResult[],
    threshold = 0.6
  ): number[] => {
    const artists = map(item.track.artists, "name").join(", ");

    const fuse = new Fuse(items, {
      isCaseSensitive: false,
      includeScore: true,
      shouldSort: false,
      threshold,
      keys: ["artists"],
    });

    const results = fuse.search(artists);

    return map(items, ({ index }) => {
      const result = find(results, ["item.index", index]);
      return result?.score ?? 1;
    });
  };

  interface ScoredSearchResult extends PreparedSearchResult {
    scores: number[];
    score: number;
  }

  const compareSongs = (
    items: PreparedSearchResult[]
  ): ScoredSearchResult[] => {
    const results = [
      compareDurations(items),
      compareTitles(items),
      compareArtists(items),
    ];

    return map(items, (item, i) => {
      const scores = map(results, i);
      const score = sum(scores);
      return { ...item, scores, score };
    }).sort((a, b) => a.score - b.score);
  };

  const results = compareSongs(prepared);

  return results[0].song;
}

export async function searchYoutubeSong<
  TOptions extends SpotiOptions & { cache?: boolean }
>(
  item: Spotify.Item,
  options?: TOptions,
  progress?: () => void,
  throttle?: () => Promise<void>
): Promise<YoutubeSearchResult> {
  return new Promise<YoutubeSearchResult>(async (resolve) => {
    const { track } = item;
    const { artists, name: song, uri } = track;
    const artist = artists[0].name;
    const query = [artist, song].join(" ").trim();
    const cached = options?.cache ?? true;

    if (cached) {
      const resource = cache.get<SpotifySearchResult>(uri);

      if (resource?.search) {
        progress?.();
        return resolve(resource.search);
      }
    }

    try {
      // Optionally throttle requests to help prevent rate limiting and IP address blocking
      await throttle?.();
      const results = await YoutubeApi.searchSongs({ query }, options);
      const result = findBestSearchResult(results, item, options);
      resolve({ query, result });
    } catch (e) {
      // @TODO If we cannot acquire search results, then the song may not exist on Youtube
      resolve({ query });
    } finally {
      progress?.();
    }
  });
}

export async function hydrateYoutubeSearch<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions,
  progress?: () => void
): Promise<void> {
  const dispatch = pool(25);

  const tasks: (() => Promise<YoutubeSearchResult>)[] = items.map(
    (item) => () => searchYoutubeSong(item, options, progress)
  );

  const results = await dispatch<YoutubeSearchResult>(tasks);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const search = results[i];
    item.search = search;
    cache.set(item.track.uri, item);
  }
}
