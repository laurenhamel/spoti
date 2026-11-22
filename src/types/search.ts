import type { Lastfm, Youtube, Spotify, Musicbrainz } from "../models";
import type { SpotiOptions } from "./configuration";
import type { MaybeLibraryFile } from "./library";

export type SearchResult = {
  track: Spotify.Track;
  youtube?: Youtube.Song;
  lastfm?: Lastfm.Track;
  musicbrainz?: Musicbrainz.Recording;
};

export type SearchOf<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  options?: TOptions
) => Promise<SearchResult[]>;

export type SearchResultItem = MaybeLibraryFile<Spotify.Item> & {
  search: SearchResult;
};
