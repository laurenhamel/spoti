import { type LiteralArrayOf } from "../../types/utils";
import { type Search } from "./Search";

export type Song = LiteralArrayOf<
  NonNullable<NonNullable<Search["songs"]>["contents"]>
>[number];
