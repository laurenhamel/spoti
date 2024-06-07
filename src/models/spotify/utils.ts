import { type Album } from "./Album";
import { type Artist } from "./Artist";
import { type Playlist } from "./Playlist";
import { type Track } from "./Track";
import { type User } from "./User";
import { Type } from "./shared";

export type ModelOf<TType extends Type> = TType extends Type.ALBUM
  ? Album
  : TType extends Type.ARTIST
  ? Artist
  : TType extends Type.PLAYLIST
  ? Playlist
  : TType extends Type.TRACK
  ? Track
  : TType extends Type.USER
  ? User
  : never;
