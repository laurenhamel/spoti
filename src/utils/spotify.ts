import { trimStart } from "lodash-es";
import { Spotify } from "../models";

export function validateSpotifyURL(url: string): void {
  const { hostname } = new URL(url);

  if (!hostname.endsWith("spotify.com")) {
    throw new Error("The provided URL is not a Spotify link.");
  }
}

/**
 * Parse Spotify URLs to extract relevant data
 * @example https://open.spotify.com/playlist/5g0EvNDibjJFgJeG7dAGeZ
 */
export function parseSpotifyURL(url: string): {
  type: Spotify.Type;
  id: string;
} {
  const { pathname } = new URL(url);
  const [type, id] = trimStart(pathname, "/").split("/");
  return { type: type as Spotify.Type, id };
}
