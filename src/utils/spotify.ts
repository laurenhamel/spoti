import { trimStart } from "lodash-es";
import { Spotify } from "../models";

export function isSpotifyURL(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith("spotify.com");
  } catch (_) {
    return false;
  }
}

export function validateSpotifyURL(url: string): void {
  if (!isSpotifyURL(url)) {
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
