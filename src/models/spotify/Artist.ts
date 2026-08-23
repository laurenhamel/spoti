import { type Image } from "./Image";
import { type User } from "./User";
import { type Type } from "./shared";

export type Artist = Omit<User, "type"> & {
  type: Type.ARTIST;
  name: string;
  genres: string[];
  popularity: number;
  images: Image[];
};
