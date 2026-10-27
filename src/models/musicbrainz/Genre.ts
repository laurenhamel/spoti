import type { Tag } from "./Tag";

export interface Genre extends Tag {
  id: string;
  disambiguation: string;
}
