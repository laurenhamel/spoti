import { Spotify } from "../models";
import { SpotifyApi } from "../services";
import { SpotiOptions } from "../types";
import { map } from "lodash-es";

export async function getSpotifyFeatures<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions
): Promise<Spotify.Features[]> {
  return new Promise<Spotify.Features[]>(async (resolve) => {
    const ids = map(items, "track.id");

    try {
      const payload = { ids };
      const result = await SpotifyApi.getTracksAudioFeatures(payload, options);
      resolve(result.audio_features as Spotify.Features[]);
    } catch (e) {
      // @TODO If we cannot acquire track data, then likely a catastrophic API failure happened
      resolve(new Array(ids.length) as Spotify.Features[]);
    }
  });
}

export async function hydrateSpotifyFeatures<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions
): Promise<void> {
  return getSpotifyFeatures(items, options).then((results) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const features = results[i];
      item.features = features;
    }
  });
}
