import { type DownloadTarget } from "../../types/download";
import { getConfigurationKey } from "../../utils/configuration";
import {
  PluginEnforcement,
  type PluginName,
  type PluginPrototype,
} from "../types";
import { getPluginConfiguration } from "../utils";
import { type GenreMapperConfiguration } from "./types";
import { mapGenres, parseMapping, readGenres, writeGenres } from "./utils";
import { type Tags } from "node-id3";

const PLUGIN_NAME: PluginName = "com.spoti.GenreMapper";

export class GenreMapper implements PluginPrototype {
  name = PLUGIN_NAME;
  enforce = PluginEnforcement.POST;

  config: GenreMapperConfiguration = {};

  constructor() {
    this.config = getPluginConfiguration<GenreMapperConfiguration>(PLUGIN_NAME);
  }

  transformTags(item: DownloadTarget, tags: Tags): void {
    const delimiter = getConfigurationKey("tags.genreDelimiter");
    const rules = parseMapping(this.config.mapping);
    if (!rules.length) return;
    const previous = readGenres(tags, this.config.sources, delimiter);
    const next = mapGenres(previous, rules);
    writeGenres(tags, next, delimiter);
  }
}

GenreMapper.prototype.name = PLUGIN_NAME;
