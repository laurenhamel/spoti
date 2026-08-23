import { type Spotify } from "../models";
import { SpotifyApi } from "../services";
import { type SpotiOptions } from "../types/config";
import { map } from "lodash-es";

export async function getSpotifyFeatures<TOptions extends SpotiOptions>(
  item: Spotify.Item,
  options?: TOptions
): Promise<Spotify.Features | undefined> {
  try {
    type Response = { audio_features: Spotify.Features };
    const payload = { id: item.track.id };
    const result = await SpotifyApi.getTrackAudioFeatures<Response>(
      payload,
      options
    );

    return result.audio_features;
  } catch (_) {
    return;
  }
}

export async function getMultipleSpotifyFeatures<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions
): Promise<Spotify.Features[]> {
  const ids = map(items, "track.id");

  try {
    type Response = { audio_features: Spotify.Features[] };
    const payload = { ids };
    const result = await SpotifyApi.getTracksAudioFeatures<Response>(
      payload,
      options
    );

    return result.audio_features;
  } catch (_) {
    return [];
  }
}

export async function hydrateSpotifyFeatures<TOptions extends SpotiOptions>(
  items: Spotify.Item[],
  options?: TOptions
): Promise<void> {
  return getMultipleSpotifyFeatures(items, options).then((results) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const features = results[i];
      item.features = features;
    }
  });
}
