import type { DownloadTarget, DownloadResult } from "./download";
import type { SpotifyStatus } from "./spotify";

export type TaggingResult<TSource extends DownloadTarget | DownloadResult> =
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      source: TSource;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };
