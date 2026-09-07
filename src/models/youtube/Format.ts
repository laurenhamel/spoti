/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Format {
  abr: number;
  acodec: string;
  aspect_ratio: number | null;
  asr: number;
  audio_channels: number;
  audio_ext: string;
  available_at: number;
  columns: number;
  downloader_options: any;
  dynamic_range: string;
  ext: string;
  filesize_approx?: number | null;
  filesize?: number;
  format_id: string;
  format_index: null;
  format_note: string;
  format: string;
  fps: number;
  fragments: any[];
  height: number | null;
  http_headers: any;
  manifest_url?: string;
  language_preference: number | null;
  preference: number | null;
  protocol: string;
  quality: number;
  has_drm: boolean;
  resolution: `${number}x${number}`;
  rows: number;
  source_preference: number;
  tbr: number | null;
  url: string;
  vbr: number;
  vcodec: string;
  video_ext: string;
  width: number | null;
}
