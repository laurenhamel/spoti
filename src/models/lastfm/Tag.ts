import type { URL } from "./shared";

export interface Tag {
  name: string;
  url: URL<`/tag/${string}`>;
}
