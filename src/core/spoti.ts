import { Spotify } from "../models";
import { downloadSpotifyTracks } from "./downloads";
import { getSpotifyPlaylist } from "./playlists";
import { getSpotifyType } from "./spotify";
import { SpotifySearchResult, type SpotiOptions } from "../types";
import chalk from "chalk";
import { getSpotifyTrack } from "./tracks";
import { castArray, padStart } from "lodash-es";

export class Spoti {
  static async metadata<
    TType extends Spotify.Type,
    TOptions extends SpotiOptions
  >(
    id: string,
    type: TType,
    options?: TOptions
  ): Promise<Spotify.ModelOf<TType>> {
    return getSpotifyType(id, type, options);
  }

  static async search<
    TType extends Spotify.Type,
    TOptions extends SpotiOptions
  >(
    id: string,
    type: TType,
    options?: TOptions
  ): Promise<SpotifySearchResult[]> {
    const metadata = await this.metadata(id, type, options);

    switch (type) {
      case Spotify.Type.PLAYLIST: {
        const model = metadata as Spotify.Playlist;
        return getSpotifyPlaylist(model, options);
      }
      case Spotify.Type.TRACK: {
        const model = metadata as Spotify.Track;
        return castArray(await getSpotifyTrack(model, options));
      }
      default: {
        throw new Error(`Sorry, ${type}s not yet supported.`);
      }
    }
  }

  static async download<
    TType extends Spotify.Type,
    TOptions extends SpotiOptions
  >(
    id: string,
    type: TType,
    options?: TOptions
  ): Promise<ReturnType<typeof downloadSpotifyTracks>> {
    const tracks = await this.search(id, type, options);
    const results = await downloadSpotifyTracks(tracks, options);
    const { passed, failed } = results;

    const padding = Math.max(
      ...[passed.length.toString().length, failed.length.toString().length]
    );

    const format = (count: number, passing: boolean): string => {
      const value = padStart(count.toString(), padding, " ");
      const color = passing ? chalk.green : chalk.red;
      const icon = passing ? "✓" : "𐄂";
      const status = passing ? "downloaded" : "failed";
      return `${color(icon)} ${color(value)} track(s) ${status}.`;
    };

    console.log("");
    console.log(chalk.bold("Results:"));
    console.log(format(passed.length, true));
    console.log(format(failed.length, false));

    if (options?.verbose) {
      for (const { error } of failed) {
        console.error("");
        console.error(chalk.red(error.message));
      }
    }

    console.log("");
    console.log("See above for details!");

    return results;
  }
}
