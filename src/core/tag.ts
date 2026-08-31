import { type Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/config";
import { type LibraryManifest, type LibraryFile } from "../types/library";
import { mergeOptions } from "../utils/action";
import { prepareTracks } from "../utils/downloads";
import { Library } from "../utils/library";
import { Progress } from "../utils/progress";
import { pool } from "../utils/promise";
import { searchYoutubeSongs } from "../utils/search";
import { getSpotifyTracks, searchSpotifyTracks } from "../utils/spotify";
import { stringifyManifest } from "../utils/stringify";
import { getTrackTags } from "../utils/tags";
import chalk from "chalk";
import { find, map, sortBy } from "lodash-es";
import { type Primitive } from "type-fest";

export type TagArguments = [string];

export interface TagOptions extends SpotiOptions {
  cache: boolean;
  dry: boolean;
}

const TAG_DEFAULTS: TagOptions = {
  cache: true,
  dry: false,
  verbose: false,
};

export const tag: ActionHandler<TagArguments, TagOptions> = async <
  TOptions extends TagOptions,
>(
  file?: string,
  config?: TOptions
) => {
  const options = mergeOptions(TAG_DEFAULTS, config);
  const manifest = await Library.manifest(file, options);

  const scanning = new Progress({
    label: "Scanning…",
    total: manifest.files.length,
    color: chalk.blue,
  });

  const tracks: {
    file: LibraryFile;
    track: Spotify.Track;
  }[] = [];

  const ids: {
    file: LibraryFile;
    id: string;
  }[] = [];

  const files: LibraryFile[] = [];

  for (const file of manifest.files) {
    if (file.item) {
      tracks.push({ file, track: file.item.item });
    } else {
      const { id } = await file.metadata();
      id ? ids.push({ file, id }) : files.push(file);
    }

    scanning.increment();
  }

  scanning.done();

  const known = await getSpotifyTracks(map(ids, "id"), options);

  known.forEach((track, i) => {
    const { file } = ids[i];
    file.item = { item: track } as Spotify.Item;
    tracks.push({ file, track });
  });

  const unknown = await searchSpotifyTracks(files, options);

  unknown.forEach((track, i) => {
    const file = files[i];
    file.item = { item: track } as Spotify.Item;
    tracks.push({ file, track });
  });

  // prettier-ignore
  const items = map(tracks, 'track').map((item) => ({ item })) as Spotify.Item[];
  const results = await searchYoutubeSongs(items, options);
  const prepared = prepareTracks(map(tracks, "track"), results, options);
  const tagged = await getTrackTags(prepared, options);

  const tagging = new Progress({
    label: "Tagging…",
    total: tagged.length,
    color: chalk.blue,
  });

  const tasks = sortBy(tracks, "track.title").map(
    ({ file, track }) =>
      async (): Promise<void> => {
        const { id } = track;
        const { src, tags } = find(tagged, { id })!;
        file.id = id;
        file.tags = tags;
        if (src && !options.dry) await Library.tag(src, tags, id);
        tagging.increment();
      }
  );

  const dispatch = pool(25);
  await dispatch(tasks);
  tagging.done();

  const patched: LibraryManifest = { files: map(tracks, "file") };
  const settings = { ...options, more: true };
  const details: Record<string, Primitive> = {};
  const info = await stringifyManifest(patched, settings, details);

  console.log();
  console.log(info);

  if (options.dry) {
    console.log();
    console.log(chalk.blue("This was a dry run. No changes have been saved!"));
  }
};
