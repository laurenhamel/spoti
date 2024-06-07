import { Spotify } from "../models";
import { YoutubeApi } from "../services";
import {
  SpotifySearchResult,
  type SpotiOptions,
  type YoutubeSearchResult,
} from "../types";
import { cache, pool } from "../utils";

export async function searchYoutubeSong<TOptions extends SpotiOptions>(
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
    const resource = cache.get<SpotifySearchResult>(uri);

    if (resource?.search) {
      progress?.();
      return resolve(resource.search);
    }

    try {
      // Optionally throttle requests to help prevent rate limiting and IP address blocking
      await throttle?.();
      const results = await YoutubeApi.searchSongs({ query }, options);
      resolve({ query, result: results[0] });
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
