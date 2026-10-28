import type { DownloadTarget, DownloadResult } from "./download";
import type { SpotifyStatus } from "./spotify";
import type { Tags } from "node-id3";

export type TaggingResult<TSource extends DownloadTarget | DownloadResult> =
  | {
      source: TSource;
      tags: Tags;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      source: TSource;
      tags?: Tags;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      source: TSource;
      tags: Tags;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };
