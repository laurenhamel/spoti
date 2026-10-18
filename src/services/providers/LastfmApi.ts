import { getConfigurationKey } from "../../utils/configuration";
import {
  PaginationAdapter,
  PolicyAdapter,
  RetryAdapter,
  QueryStringAdapter,
} from "../adapters";
import {
  RestApi,
  RestApiMethod,
  type RestApiInstance,
  type RestApiRequestMethod,
} from "../factories";

export type LastfmApiRequestMethod = RestApiRequestMethod;

const LastfmApiService = new RestApi({
  api: "https://ws.audioscrobbler.com/2.0",
  debug: "spotify",
  endpoints: {
    getTrackInfo: {
      method: RestApiMethod.GET,
      path: "/?method=track.getInfo",
    },
  },
  adapters: {
    policy: new PolicyAdapter(),
    retry: new RetryAdapter(),
    pagination: new PaginationAdapter(),
    query: new QueryStringAdapter({
      params: () => ({
        api_key: getConfigurationKey("lastfm.api.key"),
        format: "json",
      }),
    }),
  },
});

export const LastfmApi = LastfmApiService as RestApiInstance<
  typeof LastfmApiService
>;
