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
