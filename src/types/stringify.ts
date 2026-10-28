import { type Spotify } from "../models";
import { type SpotiOptions } from "./configuration";
import { type SearchResult } from "./search";
import { type Primitive } from "type-fest";

export type SpotifyTypeStringifier<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  options?: TOptions,
  details?: Record<string, Primitive>
) => string;

export type YoutubeSearchStringifier<TType extends Spotify.Type> = <
  TOptions extends SpotiOptions,
>(
  data: Spotify.ModelOf<TType>,
  results: SearchResult[],
  options?: TOptions,
  details?: Record<string, Primitive>
) => string;
