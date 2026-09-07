/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Spotify } from "../models";

export interface SpotiMetadata {
  [key: string]: any;
  id: string;
  type: Spotify.Type;
  url: string;
}
