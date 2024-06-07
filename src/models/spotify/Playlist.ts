import { type ExternalUrls, type Followers, Type } from "./shared";
import { type Image } from "./Image";
import { type Owner } from "./Owner";
import { type Tracks } from "./Tracks";

export type Playlist = {
  [key: string]: unknown;
  collaborative: boolean;
  description: string;
  external_urls: ExternalUrls;
  followers: Followers;
  href: string;
  id: string;
  images: Image[];
  name: string;
  owner: Owner;
  primary_color: string | null;
  public: boolean;
  snapshot_id: string;
  tracks: Tracks;
  type: Type.PLAYLIST;
  uri: string;
};
