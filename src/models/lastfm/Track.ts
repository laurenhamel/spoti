import type { Album } from "./Album";
import type { Artist } from "./Artist";
import type { Tag } from "./Tag";
import type { Wiki } from "./Wiki";
import type { URL } from "./shared";
import type { BooleanLike, NumberLike } from "./utils";

export interface Track {
  [key: string]: unknown;
  track: {
    id: string;
    name: string;
    mbid: string;
    url: URL<`/music/${string}/_/${string}`>;
    duration: NumberLike; // in milliseconds (ms)
    streamable: {
      fulltrack: BooleanLike;
      "#text": BooleanLike;
    };
    listeners: NumberLike;
    playcount: NumberLike;
    artist: Artist;
    album: Album;
    toptags: {
      tag: Tag[];
    };
    wiki: Wiki;
  };
}
