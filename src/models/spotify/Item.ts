import { type Track } from "./Track";
import { type User } from "./User";

export type Item = {
  [key: string]: unknown;
  added_at: string;
  added_by: User;
  is_local: boolean;
  track: Track;
};
