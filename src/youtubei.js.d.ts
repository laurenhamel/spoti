import {
  type IPlayerResponse,
  type IRawResponse,
  type Innertube,
  type SessionOptions as ISessionOptions,
} from "youtubei.js";

export * from "youtubei.js";

declare module "youtubei.js" {
  namespace Types {
    export type InnerTubeInstance = InstanceType<typeof Innertube>;

    export type Format = Parameters<Types.FormatFilter>[0];

    export type VideoInfo = Awaited<ReturnType<InnerTubeInstance["getInfo"]>>;

    // prettier-ignore
    export type TrackInfo = Awaited<ReturnType<InnerTubeInstance["music"]['getInfo']>>;

    export type PlayerResponse = IPlayerResponse;

    export type RawResponse = IRawResponse;

    export type SessionOptions = ISessionOptions;
  }
}
