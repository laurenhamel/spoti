import { type Spotify } from "../models";
import { type ActionHandler } from "../types/action";
import { type SpotiOptions } from "../types/configuration";
import { type MaybeLibraryFile } from "../types/library";
import { mergeOptions } from "../utils/action";
import { reportDry, reportManifest } from "../utils/console";
import { prepareTracks } from "../utils/downloads";
import { Library } from "../utils/library";
import { searchSongs } from "../utils/search";
import { addTrackTags } from "../utils/tags";
import chalk from "chalk";
import { find, map } from "lodash-es";

export type TagArguments = [string?];

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
  const options = await mergeOptions(TAG_DEFAULTS, config);
  const { index, manifest } = await Library.index(file, options, {
    label: "Scanning…",
    color: chalk.blue,
  });

  const items = index.map(({ file: library, track }) => ({
    item: { ...track, library },
  })) as MaybeLibraryFile<Spotify.Item>[];

  const results = await searchSongs(items, options);
  const targets = prepareTracks(map(items, "item"), results, options);
  const tags = await addTrackTags(targets, options);

  for (const { file } of index) {
    if (file.item) {
      file.tagging = find(tags, ["source.item.id", file.item.item.id]);
    }
  }

  await reportManifest(manifest, {
    ...options,
    more: true,
  });

  reportDry(options);
};
