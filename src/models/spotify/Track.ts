import { type Album } from "./Album";
import { type Artist } from "./Artist";
import {
  type ExternalIds,
  type ExternalUrls,
  type VideoThumbnail,
  Type,
} from "./shared";

export type Track = {
  [key: string]: unknown;
  album: Album;
  artists: Artist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  episode: boolean;
  external_ids: ExternalIds;
  external_urls: ExternalUrls;
  href: string;
  id: string;
  is_playable: false;
  linked_from: Record<string, unknown>;
  restrictions?: Record<"reason", string>;
  name: string;
  popularity: number;
  preview_url: string;
  track_number: number;
  track: boolean;
  type: Type.TRACK;
  uri: string;
  is_local: boolean;
  video_thumbnail: VideoThumbnail;
};
