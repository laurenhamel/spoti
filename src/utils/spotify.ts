import { Spotify } from "../models";
import { SpotifyApi, type SpotifyApiRequestMethod } from "../services";
import { type SpotiOptions } from "../types/config";
import { type LibraryFile } from "../types/library";
import { type SpotifyMetadataResult } from "../types/spotify";
import {
  checkPlaywrightVersion,
  ensureChromiumInstalled,
} from "./dependencies";
import { Progress } from "./progress";
import { retry } from "./promise";
import chalk from "chalk";
import { find, merge, template, flatMap, trimStart } from "lodash-es";
import fetch from "node-fetch";
import { chromium, type Request, type Page, type Browser } from "playwright";

// prettier-ignore
const SPOTIFY_PLAYLIST_URL = "https://open.spotify.com/playlist/<%= id %>";
// prettier-ignore
const SPOTIFY_PLAYLIST_API = "https://api-partner.spotify.com/pathfinder/v2/query";
// prettier-ignore
const SPOTIFY_ACCESS_TOKEN_METHOD = "GET";
// prettier-ignore
const SPOTIFY_ACCESS_TOKEN_URL = "https://open.spotify.com/api/token";
// prettier-ignore
const SPOTIFY_CLIENT_TOKEN_METHOD = "POST";
// prettier-ignore
const SPOTIFY_CLIENT_TOKEN_URL = "https://clienttoken.spotify.com/v1/clienttoken";

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
export function parseSpotifyURL(url: string): SpotifyMetadataResult {
  validateSpotifyURL(url);
  const { pathname } = new URL(url);
  const [type, id] = trimStart(pathname, "/").split("/");
  return { type: type as Spotify.Type, id };
}

const noopSpotifyApiRequest: SpotifyApiRequestMethod = async <
  TResponse extends Record<string, unknown>,
>() => ({}) as TResponse;

export async function getSpotifyPlaylist<
  TData extends Record<string, unknown>,
  TOptions extends SpotiOptions,
>(data?: TData, options?: TOptions): Promise<Spotify.Playlist> {
  try {
    const playlist = await SpotifyApi.getPlaylist(data, options);
    return playlist as Spotify.Playlist;
  } catch (error) {
    const { cause } = error as Error;

    switch ((cause as { status?: number })?.status) {
      case 404:
        return scrapeSpotifyPlaylist(data, options);
      default:
        throw error as Error;
    }
  }
}

async function scrapeSpotifyPlaylist<
  TData extends Record<string, unknown>,
  TOptions extends SpotiOptions,
>(data: TData = {} as TData, _options?: TOptions): Promise<Spotify.Playlist> {
  const id = data.id as string;

  checkPlaywrightVersion();
  ensureChromiumInstalled();

  function isAccessTokenRequest(request: Request) {
    const method = request.method();
    const url = request.url();
    return (
      method === SPOTIFY_ACCESS_TOKEN_METHOD &&
      url.startsWith(SPOTIFY_ACCESS_TOKEN_URL)
    );
  }

  function isClientTokenRequest(request: Request) {
    const method = request.method();
    const url = request.url();
    return (
      method === SPOTIFY_CLIENT_TOKEN_METHOD &&
      url.startsWith(SPOTIFY_CLIENT_TOKEN_URL)
    );
  }

  async function readAccessToken(
    request?: Request
  ): Promise<string | undefined> {
    if (!request) return;
    const response = await request.response();
    const json = await response?.json();
    return json.accessToken;
  }

  async function readClientToken(
    request?: Request
  ): Promise<string | undefined> {
    if (!request) return;
    const response = await request.response();
    const json = await response?.json();
    return json.granted_token?.token;
  }

  async function startChromium(): Promise<{
    page: Page;
    browser: Browser;
  }> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    return { browser, page };
  }

  async function waitForTokens(
    url: string,
    retries: number = 3
  ): Promise<{
    client: string;
    access: string;
  }> {
    return retry(
      async () => {
        const { page, browser } = await startChromium();

        let access: Promise<string | undefined> | undefined;
        let client: Promise<string | undefined> | undefined;

        const listener = (request: Request): void => {
          if (isAccessTokenRequest(request)) {
            access = readAccessToken(request);
          }

          if (isClientTokenRequest(request)) {
            client = readClientToken(request);
          }
        };

        page.on("request", listener);

        await page.goto(url, { waitUntil: "networkidle" });
        await browser.close({ reason: "done" });

        const token = {
          access: await access,
          client: await client,
        };

        if (!token.access || !token.client) {
          throw new Error("Failed to capture Spotify authentication tokens.");
        }

        return token as { access: string; client: string };
      },
      retries,
      1000
    );
  }

  async function fetchPlaylist(
    url: string,
    token: Awaited<ReturnType<typeof waitForTokens>>,
    data: Record<string, unknown> = {}
  ): Promise<Spotify.Scraped.Playlist> {
    const response = await fetch(SPOTIFY_PLAYLIST_API, {
      method: "post",
      headers: {
        Authorization: `Bearer ${token.access}`,
        "Client-Token": token.client,
        "Content-Type": "application/json",
        Origin: "https://open.spotify.com",
        Referer: url,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify(
        merge(
          {
            variables: {
              uri: `spotify:playlist:${id}`,
              offset: 0,
              limit: 1,
              enableWatchFeedEntrypoint: false,
            },
            operationName: "fetchPlaylist",
            extensions: {
              persistedQuery: {
                version: 1,
                sha256Hash:
                  "7982b11e21535cd2594badc40030b745671b61a1fa66766e569d45e6364f3422",
              },
            },
          },
          data
        )
      ),
    });

    const json = await response.json();

    return json as Spotify.Scraped.Playlist;
  }

  async function getPlaylistLength(
    url: string,
    token: Awaited<ReturnType<typeof waitForTokens>>
  ): Promise<number> {
    const json = await fetchPlaylist(url, token);
    return json.data.playlistV2.content.totalCount;
  }

  async function getPlaylist(
    url: string,
    token: Awaited<ReturnType<typeof waitForTokens>>
  ): Promise<Spotify.Scraped.Playlist> {
    const limit = await getPlaylistLength(url, token);
    return fetchPlaylist(url, token, { variables: { limit } });
  }

  function toPlaylist(scraped: Spotify.Scraped.Playlist): Spotify.Playlist {
    const playlist = scraped.data.playlistV2;

    const owner = {
      uri: playlist.ownerV2.data.uri,
      id: playlist.ownerV2.data.uri.split(":")[2],
    };

    const primary_color =
      find(playlist.attributes, { key: "primary_color" })?.value ?? null;

    return {
      collaborative: playlist.members.totalCount > 1,
      description: playlist.description,
      external_urls: {
        spotify: playlist.sharingInfo.shareUrl,
      },
      followers: {
        href: null,
        total: playlist.followers,
      },
      href: playlist.sharingInfo.shareUrl,
      id,
      images: flatMap(playlist.images.items, "sources"),
      name: playlist.name,
      owner: {
        display_name: playlist.ownerV2.data.name,
        external_urls: {
          spotify: `https://open.spotify.com/user/${owner.id}`, // @FIXME
        },
        followers: {
          href: null,
          total: -1, // @FIXME
        },
        href: `https://open.spotify.com/user/${owner.id}`,
        id: owner.id,
        type: Spotify.Type.USER,
        uri: owner.uri,
      },
      primary_color,
      public: true,
      snapshot_id: "", // @FIXME
      items: {
        href: "",
        limit: playlist.content.items.length,
        next: null,
        offset: 0,
        previous: null,
        total: playlist.content.items.length,
        items: playlist.content.items.map((item) => {
          const uri = item.itemV2.data.uri;
          const id = uri.split(":")[2];

          const addedBy = item.addedBy
            ? {
                uri: item.addedBy.data.uri,
                id: item.addedBy.data.uri.split(":")[2],
              }
            : null;

          const album = {
            uri: item.itemV2.data.albumOfTrack.uri,
            id: item.itemV2.data.albumOfTrack.uri.split(":")[2],
          };

          return {
            added_at: item.addedAt.isoString,
            added_by: {
              external_urls: {
                spotify: `https://open.spotify.com/user/${addedBy?.id}`,
              },
              followers: {
                href: null,
                total: -1, // @FIXME
              },
              href: `https://open.spotify.com/user/${addedBy?.id}`,
              id: addedBy?.id ?? "",
              type: Spotify.Type.USER,
              uri: addedBy?.uri ?? "",
            },
            is_local: false,
            item: {
              album: {
                album_type: "", // @FIXME
                total_tracks: -1, // @FIXME
                available_markets: [], // @FIXME
                external_urls: {
                  spotify: `https://open.spotify.com/album/${album.id}`,
                },
                href: `https://open.spotify.com/album/${album.id}`,
                id: album.id,
                images: item.itemV2.data.albumOfTrack.coverArt.sources,
                name: item.itemV2.data.albumOfTrack.name,
                release_date:
                  item.itemV2.data.albumOfTrack.date?.isoString ?? "",
                release_date_precision: "", // @FIXME
                restrictions: {
                  reason: "", // @FIXME
                },
                type: Spotify.Type.ALBUM,
                uri: album.uri,
                artists: item.itemV2.data.albumOfTrack.artists.items.map(
                  (artist) => ({
                    type: Spotify.Type.ARTIST,
                    name: artist.profile.name,
                    genres: [], // @FIXME
                    popularity: -1, // @FIXME
                    images: [], // @FIXME
                  })
                ),
              },
              artists: item.itemV2.data.artists.items.map((artist) => ({
                type: Spotify.Type.ARTIST,
                name: artist.profile.name,
                genres: [], // @FIXME
                popularity: -1, // @FIXME
                images: [], // @FIXME
              })),
              available_markets: [], // @FIXME
              disc_number: item.itemV2.data.discNumber,
              duration_ms: item.itemV2.data.trackDuration.totalMilliseconds!,
              explicit: false, // @FIXME
              episode: false,
              external_ids: {},
              external_urls: {
                spotify: `https://open.spotify.com/track/${id}`,
              },
              href: `https://open.spotify.com/track/${id}`,
              id,
              is_playable: item.itemV2.data.playability.playable,
              linked_from: {},
              name: item.itemV2.data.name,
              popularity: -1, // @FIXME
              preview_url: "", // @FIXME
              track_number: item.itemV2.data.trackNumber,
              track: true,
              type: Spotify.Type.TRACK,
              uri,
              is_local: false,
              video_thumbnail: {
                url: null,
              },
            },
          };
        }),
      },
      type: Spotify.Type.PLAYLIST,
      uri: playlist.uri,
    };
  }

  const url = template(SPOTIFY_PLAYLIST_URL)(data);
  const token = await waitForTokens(url);
  const playlist = await getPlaylist(url, token);

  return toPlaylist(playlist);
}

export async function getSpotifyTrack<
  TData extends Record<string, unknown>,
  TOptions extends SpotiOptions,
>(
  data?: TData,
  options?: TOptions,
  progress?: () => void
): Promise<Spotify.Track> {
  const track = await SpotifyApi.getTrack(data, options);
  progress?.();
  return track as Spotify.Track;
}

export async function getSpotifyTracks<TOptions extends SpotiOptions>(
  ids: string[],
  options?: TOptions
): Promise<Spotify.Track[]> {
  const progress = new Progress({
    label: "Fetching tracks…",
    total: ids.length,
    color: chalk.yellow,
  });

  const results = await Promise.all(
    ids.map((id) =>
      getSpotifyTrack({ id }, options, () => progress.increment())
    )
  );

  progress.done();

  return results;
}

export async function searchSpotifyTrack<TOptions extends SpotiOptions>(
  file: LibraryFile,
  options?: TOptions,
  progress?: () => void
): Promise<Spotify.Track> {
  const query = file.title;

  const { tracks } = await SpotifyApi.searchItems<Spotify.Search.Tracks>(
    { query, type: "track" },
    options
  );

  progress?.();

  return tracks.items[0];
}

export async function searchSpotifyTracks<TOptions extends SpotiOptions>(
  files: LibraryFile[],
  options?: TOptions
): Promise<Spotify.Track[]> {
  const progress = new Progress({
    label: "Searching Spotify…",
    total: files.length,
    color: chalk.yellow,
  });

  const results = await Promise.all(
    files.map((file) =>
      searchSpotifyTrack(file, options, () => progress.increment())
    )
  );

  progress.done();

  return results;
}

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
    [Spotify.Type.PLAYLIST]: getSpotifyPlaylist as SpotifyApiRequestMethod,
    [Spotify.Type.TRACK]: getSpotifyTrack as SpotifyApiRequestMethod,
    [Spotify.Type.USER]: noopSpotifyApiRequest,
  };

  const callee = callees[type];

  return callee<Spotify.ModelOf<TType>>({ id }, options);
}
