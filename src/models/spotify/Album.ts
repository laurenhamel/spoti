import { type Artist } from "./Artist";
import { type Image } from "./Image";
import { type ExternalUrls, type Type } from "./shared";

export type Album = {
  [key: string]: unknown;
  album_type: string;
  total_tracks: number;
  available_markets: string[];
  external_urls: ExternalUrls;
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  restrictions: Record<"reason", string>;
  type: Type.ALBUM;
  uri: string;
  artists: Artist[];
};
