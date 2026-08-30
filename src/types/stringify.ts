import { type Spotify } from "../models";
import { type SpotiOptions } from "./config";
import { type YoutubeSearchResult } from "./youtube";
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
  results: YoutubeSearchResult[],
  options?: TOptions,
  details?: Record<string, Primitive>
) => string;
