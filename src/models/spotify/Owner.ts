import { type User } from "./User";

export type Owner = User & {
  display_name: string;
};
