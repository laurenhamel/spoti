import { type Types } from "youtubei.js";

export type Search = Awaited<
  ReturnType<Types.InnerTubeInstance["music"]["search"]>
>;
