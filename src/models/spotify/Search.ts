import { type Track } from "./Track";

export interface Tracks {
  [key: string]: unknown;
  tracks: {
    href: string;
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
    items: Track[];
  };
}
