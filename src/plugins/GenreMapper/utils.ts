import {
  parseGenres,
  stringifyGenres,
  DEFAULT_GENRE_DELIMITER,
} from "../../utils/tags";
import { type GenreMapperMapping, type GenreMapperRule } from "./types";
import { castArray, compact, find, get, has, isEmpty } from "lodash-es";
import { type Tags } from "node-id3";

export function parseMapping(
  mapping: GenreMapperMapping = {}
): GenreMapperRule[] {
  return Object.entries(mapping).map(([regex, output]) => ({
    pattern: new RegExp(regex, "i"),
    output: castArray(output),
  }));
}

export function readGenres(
  tags: Tags,
  fields: string[] = [],
  delimiter: string = DEFAULT_GENRE_DELIMITER
): string[] {
  return [
    ...parseGenres(tags.genre, delimiter),
    ...compact(
      fields.flatMap((field) => {
        if (has(tags, field)) {
          return parseGenres(get(tags, field) as string, delimiter);
        }

        return parseGenres(
          find(tags.userDefinedText ?? [], { description: field })?.value,
          delimiter
        );
      })
    ),
  ];
}

export function writeGenres(
  tags: Tags,
  genres: string[],
  delimiter: string = DEFAULT_GENRE_DELIMITER
): void {
  tags.genre = stringifyGenres(genres, delimiter);
}

export function mapGenres(
  genres: string[],
  rules: GenreMapperRule[]
): string[] {
  const results = new Set<string>();

  for (const genre of genres) {
    if (isEmpty(genre)) continue;

    let matched = false;

    for (const { pattern, output } of rules) {
      if (pattern.test(genre)) {
        matched = true;
        output.forEach((item) => results.add(item));
      }
    }

    // Pass-through unmapped unique genres as-is
    if (!matched) results.add(genre);
  }

  return Array.from(results);
}
