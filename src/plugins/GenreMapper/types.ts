import type {
  SpotiPluginName,
  SpotiPluginConfiguration,
} from "../../types/plugin";

export type GenreMapperPluginName = SpotiPluginName<"GenreMapper">;

export interface GenreMapperConfiguration {
  sources?: string[];
  mapping?: GenreMapperMapping;
}

export interface GenreMapperMapping {
  [pattern: string]: string | string[];
}

export interface GenreMapperRule {
  pattern: RegExp;
  output: string[];
}

export type GenreMapperPluginConfiguration = SpotiPluginConfiguration<
  GenreMapperPluginName,
  GenreMapperConfiguration
>;
