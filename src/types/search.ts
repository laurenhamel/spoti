import { type Lastfm, type Youtube, type Spotify } from "../models";
import { type SpotiOptions } from "./configuration";

export type SearchResult = {
  track: Spotify.Track;
  youtube?: Youtube.Song;
};

export type SearchOf<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  options?: TOptions
) => Promise<SearchResult[]>;

export type SearchResultItem = Spotify.Item & {
  search: SearchResult;
};
