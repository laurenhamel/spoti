import {
  AccessTokenAdapter,
  AccessTokenAdapterType,
  PaginationAdapter,
  PolicyAdapter,
  RetryAdapter,
} from "../adapters";
import {
  RestApi,
  RestApiMethod,
  type RestApiInstance,
  type RestApiRequestMethod,
} from "../factories";

export type SpotifyApiRequestMethod = RestApiRequestMethod;

const SpotifyApi = new RestApi({
  api: "https://api.spotify.com/v1",
  endpoints: {
    getPlaylist: {
      method: RestApiMethod.GET,
      path: "/playlists/{id}",
      pagination: {
        target: "items.items",
        offset: "items.offset",
        total: "items.total",
        limit: "items.limit",
        previous: "items.previous",
        next: "items.next",
      },
    },
    /** @deprecated Track pagination still uses this endpoint currently. */
    getPlaylistTracks: {
      method: RestApiMethod.GET,
      path: "/playlists/{id}/tracks",
      data: { limit: null },
      pagination: {
        target: "items",
        offset: "offset",
        total: "total",
        limit: "limit",
        previous: "previous",
        next: "next",
      },
    },
    getPlaylistItems: {
      method: RestApiMethod.GET,
      path: "/playlists/{id}/items",
      data: { limit: null },
      pagination: {
        target: "items",
        offset: "offset",
        total: "total",
        limit: "limit",
        previous: "previous",
        next: "next",
      },
    },
    getTrack: {
      method: RestApiMethod.GET,
      path: "/tracks/{id}",
    },
  },
  adapters: {
    authorization: new AccessTokenAdapter<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>({
      url: "https://accounts.spotify.com/api/token",
      type: AccessTokenAdapterType.FORM,
      credentials: {
        grant_type: "client_credentials",
        client_id: process.env.SPOTI_SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTI_SPOTIFY_CLIENT_SECRET,
      },
      handler(response) {
        return {
          token: response.access_token,
          type: response.token_type,
          expires: new Date(Date.now() + response.expires_in * 1000),
        };
      },
    }),
    policy: new PolicyAdapter(),
    retry: new RetryAdapter(),
    pagination: new PaginationAdapter(),
  },
});

export default SpotifyApi as RestApiInstance<typeof SpotifyApi>;
