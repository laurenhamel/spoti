import { type Innertube } from "youtubei.js";

export type InnertubeApiInstance = Awaited<ReturnType<typeof Innertube.create>>;
