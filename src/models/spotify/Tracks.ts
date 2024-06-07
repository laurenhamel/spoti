import { type Item } from "./Item";

export type Tracks = {
  [key: string]: unknown;
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: Item[];
};
