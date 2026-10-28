import { type DownloadTarget } from "../../types/download";
import { getConfigurationKey } from "../../utils/configuration";
import { DEFAULT_GENRE_DELIMITER } from "../../utils/tags";
import {
  PluginEnforcement,
  type PluginName,
  type PluginPrototype,
} from "../types";
import { getPluginConfiguration } from "../utils";
import { type GenreMapperConfiguration } from "./types";
import { mapGenres, parseMapping, readGenres, writeGenres } from "./utils";
import { defaultTo } from "lodash-es";
import { type Tags } from "node-id3";

const PLUGIN_NAME: PluginName = "com.spoti.GenreMapper";

export class GenreMapper implements PluginPrototype {
  name = PLUGIN_NAME;
  enforce = PluginEnforcement.POST;
  config: GenreMapperConfiguration = {};
  delimiter: string = DEFAULT_GENRE_DELIMITER;

  resolvedConfiguration() {
    this.config = getPluginConfiguration<GenreMapperConfiguration>(PLUGIN_NAME);
    this.delimiter = defaultTo<string>(
      getConfigurationKey("tags.genreDelimiter"),
      this.delimiter
    );
  }

  transformTags(item: DownloadTarget, tags: Tags): void {
    const rules = parseMapping(this.config.mapping);
    if (!rules.length) return;
    const previous = readGenres(tags, this.config.sources, this.delimiter);
    const next = mapGenres(previous, rules);
    writeGenres(tags, next, this.delimiter);
  }
}

GenreMapper.prototype.name = PLUGIN_NAME;
