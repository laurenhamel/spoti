import type { Image } from "./Image";
import type { URL } from "./shared";

export interface Album {
  artist: string;
  title: string;
  url: URL<`/music/${string}/${string}`>;
  image: Image[];
}
