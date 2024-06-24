import {
  RestApi,
  RestApiMethod,
  type RestApiInstance,
  type RestApiRequestMethod,
} from "../factories";
import {
  AccessTokenAdapter,
  AccessTokenAdapterType,
  RetryAdapter,
} from "../adapters";

export type SpotifyApiRequestMethod = RestApiRequestMethod;

const SpotifyApi = new RestApi({
  api: "https://api.spotify.com/v1",
  endpoints: {
    getPlaylist: {
      method: RestApiMethod.GET,
      path: "/playlists/<%= id %>",
    },
    getPlaylistTracks: {
      method: RestApiMethod.GET,
      path: "/playlists/<%= id %>/tracks",
      data: { limit: 50 },
    },
    getTrack: {
      method: RestApiMethod.GET,
      path: "/tracks/<%= id %>",
    },
    getTrackAudioFeatures: {
      method: RestApiMethod.GET,
      path: "/audio-features/<%= id %>",
      retry: false,
    },
    getTracksAudioFeatures: {
      method: RestApiMethod.GET,
      path: "/audio-features",
      retry: false,
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
          expires: new Date(Date.now() + response.expires_in),
        };
      },
    }),
    retry: new RetryAdapter(),
  },
});

export default SpotifyApi as RestApiInstance<typeof SpotifyApi>;
