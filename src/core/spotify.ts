import { Spotify } from "../models";
import { SpotifyApi, type SpotifyApiRequestMethod } from "../services";
import { type SpotiOptions } from "../types/config";

const noopSpotifyApiRequest: SpotifyApiRequestMethod = async <
  TResponse extends Record<string, unknown>,
>() => ({}) as TResponse;

export async function getSpotifyType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(
  id: string,
  type: TType,
  options?: TOptions
): Promise<Spotify.ModelOf<TType>> {
  const callees: Record<Spotify.Type, SpotifyApiRequestMethod> = {
    [Spotify.Type.ALBUM]: noopSpotifyApiRequest,
    [Spotify.Type.ARTIST]: noopSpotifyApiRequest,
    [Spotify.Type.FEATURES]: noopSpotifyApiRequest,
    [Spotify.Type.PLAYLIST]: SpotifyApi.getPlaylist,
    [Spotify.Type.TRACK]: SpotifyApi.getTrack,
    [Spotify.Type.USER]: noopSpotifyApiRequest,
  };

  const callee = callees[type];
  const data = { id };

  return callee<Spotify.ModelOf<TType>>(data, options);
}
