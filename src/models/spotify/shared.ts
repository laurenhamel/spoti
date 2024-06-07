export type ExternalUrls = Record<"spotify", string>;

export interface ExternalIds {
  isrc?: string;
  ean?: string;
  upc?: string;
}

export interface Followers {
  href: string | null;
  total: number;
}

export interface VideoThumbnail {
  url: string | null;
}

export enum Type {
  ALBUM = "album",
  ARTIST = "artist",
  FEATURES = "audio_features",
  PLAYLIST = "playlist",
  TRACK = "track",
  USER = "user",
}
