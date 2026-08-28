import { Spotify } from "../models";
import { SpotifyApi, type SpotifyApiRequestMethod } from "../services";
import { type SpotiOptions } from "../types/config";
import { type SpotifyTypeStringifier } from "../types/spotify";
import { Format } from "../utils/format";
import chalk from "chalk";
import Table from "cli-table3";
import { map, padStart } from "lodash-es";

const noopSpotifyApiRequest: SpotifyApiRequestMethod = async <
  TResponse extends Record<string, unknown>,
>() => ({}) as TResponse;

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
    [Spotify.Type.PLAYLIST]: SpotifyApi.getPlaylist,
    [Spotify.Type.TRACK]: SpotifyApi.getTrack,
    [Spotify.Type.USER]: noopSpotifyApiRequest,
  };

  const callee = callees[type];

  return callee<Spotify.ModelOf<TType>>({ id }, options);
}

const stringifyNoop: SpotifyTypeStringifier<Spotify.Type> = () => "";

const stringifyTrack: SpotifyTypeStringifier<Spotify.Type.TRACK> = () => "";

const stringifyPlaylist: SpotifyTypeStringifier<Spotify.Type.PLAYLIST> = (
  data,
  _options
) => {
  const { id, description, name, items: tracks } = data;
  const owner = data.owner.display_name;
  const length = tracks.items.length;
  const padding = `${length}`.length;

  const head = new Table();

  head.push(
    [chalk.bold("ID"), id],
    [chalk.bold("Playlist"), name],
    [chalk.bold("Description"), description],
    [chalk.bold("Songs"), length],
    [chalk.bold("Owner"), owner]
  );

  const body = new Table({
    head: [
      chalk.blue("#"),
      chalk.blue("ID"),
      chalk.blue("Track"),
      chalk.blue("Artist"),
      chalk.blue("Duration"),
    ],
  });

  for (let i = 0; i < length; i++) {
    const track = tracks.items[i];
    const count = padStart(`${i + 1}`, padding, "0");

    body.push([
      count,
      track.item.id,
      track.item.name,
      map(track.item.artists, "name").join(", "),
      Format.getDuration(track.item),
    ]);
  }

  return [head.toString() + "\n", body.toString()].join("\n");
};

export function stringifyType<
  TType extends Spotify.Type,
  TOptions extends SpotiOptions,
>(type: TType, data: Spotify.ModelOf<TType>, options: TOptions): string {
  const callees: { [TType in Spotify.Type]: SpotifyTypeStringifier<TType> } = {
    [Spotify.Type.ALBUM]: stringifyNoop,
    [Spotify.Type.ARTIST]: stringifyNoop,
    [Spotify.Type.FEATURES]: stringifyNoop,
    [Spotify.Type.PLAYLIST]: stringifyPlaylist,
    [Spotify.Type.TRACK]: stringifyTrack,
    [Spotify.Type.USER]: stringifyNoop,
  };

  const callee = callees[type];

  return callee<TOptions>(data, options);
}
