import { type Search } from "./Search";
import { type LiteralArrayOf } from "../../types";

export type Song = LiteralArrayOf<
  NonNullable<NonNullable<Search["songs"]>["contents"]>
>[number];
