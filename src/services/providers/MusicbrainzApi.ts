import pkg from "../../../package.json";
import {
  PolicyAdapter,
  RetryAdapter,
  QueryStringAdapter,
  HeaderAdapter,
} from "../adapters";
import {
  RestApi,
  RestApiMethod,
  type RestApiInstance,
  type RestApiRequestMethod,
} from "../factories";

const MUSICBRAINZ_USER_AGENT = `${pkg.name}/${pkg.version} (${pkg.homepage})`;

export type MusicbrainzApiRequestMethod = RestApiRequestMethod;

const MusicbrainzApiService = new RestApi({
  api: "https://musicbrainz.org/ws/2",
  debug: "spotify",
  redirect: "follow",
  endpoints: {
    getRecording: {
      method: RestApiMethod.GET,
      path: "recording/{id}?inc=artists+isrcs+tags+genres",
    },
  },
  adapters: {
    policy: new PolicyAdapter({
      rateLimit: {
        limit: 1,
        interval: 1000,
      },
    }),
    retry: new RetryAdapter({
      codes: [429, 503],
      timeout: 5000, // 5s
      max: 5,
    }),
    headers: new HeaderAdapter({
      headers: () => ({
        "User-Agent": MUSICBRAINZ_USER_AGENT,
      }),
    }),
    query: new QueryStringAdapter({
      params: () => ({
        fmt: "json",
      }),
    }),
  },
});

export const MusicbrainzApi = MusicbrainzApiService as RestApiInstance<
  typeof MusicbrainzApiService
>;
