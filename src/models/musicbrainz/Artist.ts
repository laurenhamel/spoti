import type { Genre } from "./Genre";
import type { Tag } from "./Tag";

export interface Artist {
  tags: Tag[];
  name: string;
  "sort-name": string;
  type: string;
  disambiguation: string;
  country: string;
  id: string;
  genres: Genre[];
  "type-id": string;
}

export interface ArtistCredit {
  artist: Artist;
  joinphrase: string;
  name: string;
}
