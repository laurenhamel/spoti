import { type ExternalUrls, type Followers, Type } from "./shared";

export type User = {
  [key: string]: unknown;
  external_urls: ExternalUrls;
  followers: Followers;
  href: string;
  id: string;
  type: Type.USER;
  uri: string;
};
