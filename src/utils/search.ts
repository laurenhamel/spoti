import { Spotify, type Youtube } from "../models";
import { YoutubeApi } from "../services";
import { type SpotiOptions } from "../types/config";
import { type SpotifySearchResult } from "../types/spotify";
import {
  type YoutubeSearchOf,
  type YoutubeSearchResult,
} from "../types/youtube";
import { cache } from "./cache";
import { Progress } from "./progress";
import chalk from "chalk";
import Fuse from "fuse.js";
import { find, map, sum } from "lodash-es";

export function findBestSearchResult<TOptions extends SpotiOptions>(
  query: string,
  songs: Youtube.Song[],
  item: Spotify.Item,
  _options?: TOptions
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
      const a = item.item.duration_ms;
      const [min, max] = [a - buffer, a + buffer];
      return 1 - (b >= min ? 0.5 : 0) - (b <= max ? 0.5 : 0);
    });
  };

  /**
   * Yields a decimal between 0-1 of similarity of the track's artists + title for each item, where 0 = exact match.
   * @param items - The items to compare
   * @param threshold - The search threshold to use
   * @returns
   */
  const compareQuery = (
    items: PreparedSearchResult[],
    threshold = 0.6
  ): number[] => {
    const fuse = new Fuse(items, {
      isCaseSensitive: false,
      includeScore: true,
      shouldSort: false,
      threshold,
      keys: ["title"],
    });

    const results = fuse.search(query);

    return map(items, ({ index }) => {
      const result = find(results, ["item.index", index]);
      return result?.score ?? 1;
    });
  };

  /**
   * Yields a decimal between 0-1 of similarity of the track's title for each item, where 0 = exact match.
   * @param items - The items to compare
   * @param threshold - The search threshold to use
   * @returns
   */
  const compareTitles = (
    items: PreparedSearchResult[],
    threshold = 0.6
  ): number[] => {
    const title = item.item.name;

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
    const artists = map(item.item.artists, "name").join(", ");

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
      compareQuery(items),
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
  TOptions extends SpotiOptions & { cache?: boolean },
>(
  item: Spotify.Item,
  options?: TOptions,
  progress?: () => void
): Promise<YoutubeSearchResult> {
  const track = item.item;
  const { artists, name: song, uri } = track;
  const artist = artists[0].name;
  const query = [artist, song].join(" ").trim();
  const cached = options?.cache ?? true;

  if (cached) {
    const resource = cache.get<SpotifySearchResult>(uri);

    if (resource?.search) {
      progress?.();

      return { ...resource.search, track };
    }
  }

  try {
    const songs = await YoutubeApi.searchSongs({ query }, options);
    const videos = await YoutubeApi.searchVideos({ query }, options);
    const results = [...songs, ...videos];
    const result = findBestSearchResult(query, results, item, options);
    return { track, query, result };
  } catch (_) {
    // @TODO If we cannot acquire search results, then the song may not exist on Youtube
    return { track, query };
  } finally {
    progress?.();
  }
}

export async function searchYoutubeSongs<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions,
  progress?: () => void
): Promise<YoutubeSearchResult[]> {
  const tasks: (() => Promise<YoutubeSearchResult>)[] = items.map(
    (item) => () => searchYoutubeSong(item, options, progress)
  );

  const results = await Promise.all(tasks.map((task) => task()));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const search = results[i];
    item.search = search;
    cache.set(item.item.uri, item);
  }

  return results;
}

const searchNoop: YoutubeSearchOf<Spotify.Type> = () => Promise.resolve([]);

const searchTrack: YoutubeSearchOf<Spotify.Type.TRACK> = async (
  data,
  options
) => {
  const progress = new Progress({
    label: "Searching Youtube…",
    total: 1,
    color: chalk.yellow,
  });

  const result = await searchYoutubeSong(
    { item: data } as Spotify.Item,
    options,
    () => progress.increment()
  );

  progress.done();

  return [result];
};

const searchPlaylist: YoutubeSearchOf<Spotify.Type.PLAYLIST> = async (
  data,
  options
) => {
  const tracks = data.items.items;
  const total = tracks.length;

  const progress = new Progress({
    label: "Searching Youtube…",
    total,
    color: chalk.yellow,
  });

  const result = await searchYoutubeSongs(tracks, options, () =>
    progress.increment()
  );

  progress.done();

  return result;
};

export async function searchYoutubeType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  options?: TOptions
): Promise<YoutubeSearchResult[]> {
  const callees: { [TType in Spotify.Type]: YoutubeSearchOf<TType> } = {
    [Spotify.Type.ALBUM]: searchNoop,
    [Spotify.Type.ARTIST]: searchNoop,
    [Spotify.Type.FEATURES]: searchNoop,
    [Spotify.Type.PLAYLIST]: searchPlaylist,
    [Spotify.Type.TRACK]: searchTrack,
    [Spotify.Type.USER]: searchNoop,
  };

  const callee = callees[type];

  return callee<TOptions>(data, options);
}
