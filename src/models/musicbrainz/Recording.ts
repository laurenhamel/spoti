import type { ArtistCredit } from "./Artist";
import type { Genre } from "./Genre";
import type { Tag } from "./Tag";
import type { Date } from "./shared";

export interface Recording {
  [key: string]: unknown;
  id: string;
  title: string;
  isrcs: string[];
  disambiguation: string;
  length: number;
  genres: Genre[];
  "first-release-date": Date;
  "artist-credit": ArtistCredit[];
  video: boolean;
  tags: Tag[];
}
