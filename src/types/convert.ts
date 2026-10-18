import type { DownloadResult } from "./download";
import type { SpotifyStatus } from "./spotify";

export type ConversionResult =
  | {
      source: DownloadResult;
      status: Extract<SpotifyStatus, "passed">;
    }
  | {
      source: DownloadResult;
      status: Extract<SpotifyStatus, "skipped">;
    }
  | {
      source: DownloadResult;
      status: Extract<SpotifyStatus, "failed">;
      error: Error;
    };
