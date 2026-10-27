import {
  type Lastfm,
  type Musicbrainz,
  Spotify,
  type Youtube,
} from "../models";
import { LastfmApi } from "../services/providers/LastfmApi";
import { MusicbrainzApi } from "../services/providers/MusicbrainzApi";
import { YoutubeApi } from "../services/providers/YoutubeApi";
import { type SpotiOptions } from "../types/configuration";
import { type SearchOf, type SearchResult } from "../types/search";
import { cache } from "./cache";
import { Progress } from "./progress";
import { drain } from "./promise";
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

async function searchYoutube<
  TOptions extends SpotiOptions & { cache?: boolean },
>(item: Spotify.Item, options?: TOptions): Promise<Youtube.Song | undefined> {
  const { artists, name } = item.item;
  const artist = artists[0].name;
  const query = [artist, name].join(" ").trim();

  try {
    const songs = await YoutubeApi.searchSongs(query, options);
    const videos = await YoutubeApi.searchVideos(query, options);
    const results = [...songs, ...videos];
    return findBestSearchResult(query, results, item, options);
  } catch (_) {
    // @TODO If we cannot acquire search results, then the song may not exist on Youtube
    return;
  }
}

async function searchLastfm<
  TOptions extends SpotiOptions & { cache?: boolean },
>(item: Spotify.Item, _options?: TOptions): Promise<Lastfm.Track | undefined> {
  const { artists, name: track } = item.item;
  const artist = map(artists, "name").join(", ");

  try {
    return LastfmApi.getTrackInfo<Lastfm.Track>({ artist, track });
  } catch (_) {
    // @TODO If we cannot acquire search results, then the song may not exist on Last.fm
    return;
  }
}

async function searchMusicbrainz<
  TOptions extends SpotiOptions & { cache?: boolean },
>(
  item: Lastfm.Track,
  _options?: TOptions
): Promise<Musicbrainz.Recording | undefined> {
  const { mbid: id } = item.track;

  try {
    return MusicbrainzApi.getRecording<Musicbrainz.Recording>({ id });
  } catch (_) {
    // @TODO If we cannot acquire search results, then the recording may not exist on MusicBrainz.org
    return;
  }
}

export function findSearchResult<
  TOptions extends SpotiOptions & { cache?: boolean },
>(item: Spotify.Item, options?: TOptions): SearchResult | undefined {
  const uri = item.item.uri;
  const enabled = options?.cache ?? true;
  return enabled ? cache.get<SearchResult>(uri) : undefined;
}

export function cacheSearchResults(
  items: Spotify.Item[],
  results: SearchResult[]
): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const search = results[i];
    item.search = search;
    cache.set(item.item.uri, item);
  }
}

export async function searchSong<
  TOptions extends SpotiOptions & { cache?: boolean },
>(
  item: Spotify.Item,
  options?: TOptions,
  progress?: () => void
): Promise<SearchResult> {
  const cached = findSearchResult(item, options);

  if (cached) {
    progress?.();
    return cached;
  }

  const track = item.item;

  const [youtube, lastfm] = await Promise.all([
    searchYoutube(item, options),
    searchLastfm(item, options),
  ]);

  const musicbrainz = lastfm
    ? await searchMusicbrainz(lastfm, options)
    : undefined;

  progress?.();
  return { track, youtube, lastfm, musicbrainz };
}

export async function searchSongs<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions,
  progress?: () => void
): Promise<SearchResult[]> {
  const results = await drain(
    items.map((item) => () => searchSong(item, options, progress))
  );

  cacheSearchResults(items, results);

  return results;
}

const searchNoop: SearchOf<Spotify.Type> = () => Promise.resolve([]);

const searchTrack: SearchOf<Spotify.Type.TRACK> = async (data, options) => {
  const progress = new Progress({
    label: "Searching track…",
    total: 1,
    color: chalk.yellow,
  });

  const result = await searchSong({ item: data } as Spotify.Item, options, () =>
    progress.increment()
  );

  progress.done();

  return [result];
};

const searchPlaylist: SearchOf<Spotify.Type.PLAYLIST> = async (
  data,
  options
) => {
  const tracks = data.items.items;
  const total = tracks.length;

  const progress = new Progress({
    label: "Searching playlist…",
    total,
    color: chalk.yellow,
  });

  const result = await searchSongs(tracks, options, () => progress.increment());

  progress.done();

  return result;
};

export async function searchType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  type: TType,
  data: Spotify.ModelOf<TType>,
  options?: TOptions
): Promise<SearchResult[]> {
  const callees: { [TType in Spotify.Type]: SearchOf<TType> } = {
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
