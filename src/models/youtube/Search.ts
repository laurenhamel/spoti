import { type InnertubeApiInstance } from "./shared";

export type Search = Awaited<
  ReturnType<InnertubeApiInstance["music"]["search"]>
>;
