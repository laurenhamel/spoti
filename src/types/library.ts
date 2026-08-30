import { type AudioFormat } from "./audio";
import { type SpotiOptions } from "./config";
import { type VideoFormat } from "./video";
import { type Tags } from "node-id3";

export interface LibraryMetadata {
  tags: Tags;
  duration: number;
  id?: string;
}

export interface LibraryOptions extends SpotiOptions {
  /**
   * Whether to support prefixes in file names
   */
  prefixes: boolean;

  /**
   * Whether to support suffixes in file names
   */
  suffixes: boolean;
}

export interface LibrarySource {
  title: string;
  path: string;
  file: string;
  format: AudioFormat | VideoFormat;
  size: number;
}

export interface LibraryItem extends LibrarySource {
  raw: LibrarySource;
  metadata: () => Promise<LibraryMetadata>;
}

export type LibraryFile = LibraryItem & Partial<LibraryMetadata>;

export interface LibraryManifest {
  files: LibraryFile[];
}
