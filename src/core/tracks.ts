import { type Spotify } from "../models";
import { type SpotiOptions } from "../types/config";
import { type SpotifySearchResult } from "../types/spotify";
import { searchYoutubeSong } from "./search";

export async function getSpotifyTrack<TOptions extends SpotiOptions>(
  model: Spotify.Track,
  options?: TOptions
): Promise<SpotifySearchResult> {
  const item = { item: model } as SpotifySearchResult;
  item.search = await searchYoutubeSong(item, options);
  return item;
}
