import type { URL } from "./shared";

export interface Artist {
  name: string;
  mbid: string;
  url: URL<`/music/${string}`>;
}
