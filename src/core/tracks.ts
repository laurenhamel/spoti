import { Spotify } from "../models";
import { type SpotiOptions, type SpotifySearchResult } from "../types";
import { getSpotifyFeatures } from "./features";
import { searchYoutubeSong } from "./search";

export async function getSpotifyTrack<TOptions extends SpotiOptions>(
  model: Spotify.Track,
  options?: TOptions
): Promise<SpotifySearchResult> {
  const item = { track: model } as SpotifySearchResult;
  item.search = await searchYoutubeSong(item, options);
  item.features = await getSpotifyFeatures(item, options);
  return item;
}
