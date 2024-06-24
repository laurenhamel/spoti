import { Spotify } from "../models";
import { SpotifyApi, type SpotifyApiRequestMethod } from "../services";
import { SpotiOptions } from "../types";

export async function getSpotifyType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions
>(
  id: string,
  type: TType,
  options?: TOptions
): Promise<Spotify.ModelOf<TType>> {
  const callees: Record<Spotify.Type, SpotifyApiRequestMethod> = {
    [Spotify.Type.ALBUM]: () => Promise.resolve({} as any),
    [Spotify.Type.ARTIST]: () => Promise.resolve({} as any),
    [Spotify.Type.FEATURES]: () => Promise.resolve({} as any),
    [Spotify.Type.PLAYLIST]: SpotifyApi.getPlaylist,
    [Spotify.Type.TRACK]: SpotifyApi.getTrack,
    [Spotify.Type.USER]: () => Promise.resolve({} as any),
  };

  const callee = callees[type];
  const data = { id };

  return callee<Spotify.ModelOf<TType>>(data, options);
}
