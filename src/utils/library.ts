import { Youtube } from "../models";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, parse } from "node:path";
import { sync as glob } from "glob";
import { detectAudioFormat } from "./audio";
import { cleanFileName, getFilePath, sanitizeFileName } from "./file";
import id3, { type Tags } from "node-id3";
import { find, get, isNil, zipObject } from "lodash-es";
import { spawnSync } from "node:child_process";

const { Promise: ID3 } = id3;

export interface LibraryMetadata {
  tags: Tags;
  duration: number;
  id?: string;
}

export interface LibraryItem {
  path: string;
  format: Youtube.AudioFormat;
  size: number;
  metadata: () => Promise<LibraryMetadata>;
}

export class Library {
  static dir: string = process.env.PWD ?? "";
  static library: Record<string, LibraryItem> = {};
  static files: string[] = [];
  static mounted: boolean = false;

  /**
   * Mount the library to the given directory
   * @param dir - The root directory of the library
   */
  static async mount(dir: string): Promise<void> {
    this.dir = dir;
    this.files = this.scan(this.dir);
    this.library = this.hydrate(this.files);
    this.mounted = true;
  }

  /**
   * Scan the given directory for its list of files
   * @param dir - The directory to scan
   * @param format - Filter by audio file format
   * @returns
   */
  static scan(dir: string, format?: Youtube.AudioFormat): string[] {
    const patterns: string[] = [];

    if (!format || format === Youtube.AudioFormat.MP3) {
      patterns.push(getFilePath("*", Youtube.AudioFormat.MP3));
    }

    if (!format || format === Youtube.AudioFormat.MP4) {
      patterns.push(getFilePath("*", Youtube.AudioFormat.MP4));
    }

    if (!format || format === Youtube.AudioFormat.M4A) {
      patterns.push(getFilePath("*", Youtube.AudioFormat.M4A));
    }

    return patterns.flatMap((pattern) =>
      glob(pattern, {
        nodir: true,
        dot: true,
        cwd: dir,
      })
    );
  }

  /**
   * Hydrate the metadata for the given list of files
   * @param files - The files to scan
   * @param increment - A progress increment function
   * @returns
   */
  static hydrate(files: string[]): Record<string, LibraryItem> {
    const metadata = files.map((file) => this.metadata(file));
    return zipObject(files, metadata);
  }

  /**
   * Collect ID3 metadata from the given file
   * @param file - The file to collect metadata from
   * @returns
   */
  static metadata(file: string): LibraryItem {
    const format = detectAudioFormat(file);
    const path = this.path(file, format);
    const size = this.size(file);

    const metadata = async () => {
      const tags = await ID3.read(path);
      const duration = this.duration(file);
      const data = get(tags, "userDefinedText", []);
      const id = find(data, { description: this.ID })?.value;
      return { tags, duration, id };
    };

    return { format, path, size, metadata };
  }

  /**
   * Save ID3 tags to the given file
   * @param file - The file to tag
   * @param tags - The tags to save
   * @param id - The Spotify ID if available
   * @returns
   */
  static async tag(file: string, tags: Tags, id?: string): Promise<void> {
    id && this.assignId(tags, id);

    await ID3.write(tags, this.path(file));

    this.library[file] = await this.metadata(file);
  }

  static readonly ID = "spoti.id";

  /**
   * Add in Spotify ID metadata to the ID3 tags
   * @param tags - The tags to assign to
   * @param id - The Spotify ID to assign
   */
  private static assignId(tags: Tags, id: string): void {
    if (tags.userDefinedText) {
      const meta = find(tags.userDefinedText, { description: this.ID });

      if (meta) {
        meta.value = id;
      } else {
        tags.userDefinedText.push({ description: this.ID, value: id });
      }
    } else {
      tags.userDefinedText = [{ description: this.ID, value: id }];
    }
  }

  /**
   * Get the filename (i.e., basename and extension) of the given file
   * @param file - The file to extract the basename from
   * @param format - The expected format of the file
   * @returns
   */
  static file(file: string, format = detectAudioFormat(file)): string {
    const base = basename(file, extname(file));
    return getFilePath(base, format);
  }

  /**
   * Get the absolute path of the given file within the library
   * @param file - The file to retrieve an absolute path for
   * @param format - The expected format of the file
   * @returns
   */
  static path(file: string, format?: Youtube.AudioFormat): string {
    return join(this.dir, this.file(file, format));
  }

  /**
   * Build a title from the given filename
   * @param file - The file to build a title from
   * @returns
   */
  static title(file: string): string {
    const base = basename(file, extname(file));
    return sanitizeFileName(cleanFileName(base));
  }

  /**
   * Create a new writable file stream using the given filename
   * @param file - The filename to use for the write stream
   * @param format - The expected format of the fiell
   * @returns
   */
  static new(
    file: string,
    format = detectAudioFormat(file)
  ): ReturnType<typeof createWriteStream> {
    return createWriteStream(this.path(file, format));
  }

  /**
   * Read a file
   * @param file - The file to read from
   * @returns
   */
  static read(file: string): string {
    return readFileSync(this.path(file), { encoding: "utf-8" });
  }

  /**
   * Save a file
   * @param file - The file to write to
   * @param data - The contents to save to the file
   */
  static save(file: string, data: Buffer | string): void {
    writeFileSync(this.path(file), data);
  }

  /**
   * Delete a file
   * @param file - The file to delete
   */
  static remove(file: string): void {
    rmSync(this.path(file));
  }

  /**
   * Determine if the given file exists
   * @param file - The file to search for
   * @returns
   */
  static exists(file: string): boolean {
    return existsSync(this.path(file));
  }

  /**
   * Get the size of a file in bytes
   * @param file - The file to query
   * @returns
   */
  static size(file: string): number {
    return statSync(this.path(file)).size;
  }

  /**
   * Get the duration of a file in milliseconds (ms)
   * @param file - The file to query
   * @param duration - The precomputed duration if available
   * @returns
   */
  static duration(file: string, value?: number): number {
    let duration = value;

    if (!duration) {
      const { stdout } = spawnSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          `"${this.file(file)}"`,
        ],
        {
          cwd: this.dir,
          encoding: "utf-8",
          shell: true,
        }
      );

      duration = parseFloat(stdout.trim()) * 1000;
    }

    return duration;
  }

  /**
   * Find the M4A/MP4 source file for an MP3 track
   * @param file - The file to use to look for a source file
   * @returns
   */
  static source(file: string): string {
    const files = [
      this.file(file, Youtube.AudioFormat.M4A),
      this.file(file, Youtube.AudioFormat.MP4),
    ];

    for (const file of files) {
      if (this.exists(file)) {
        return file;
      }
    }

    return files[0];
  }

  /**
   * Find a track with the given Spotify ID in the library
   * @param id - The Spotify ID to look for
   * @param format - The format to search for
   * @returns
   */
  static find(
    id: string,
    format?: Youtube.AudioFormat
  ): LibraryItem | undefined {
    const criteria = format ? { format, id } : { id };
    return find(this.library, criteria);
  }

  /**
   * Determine if a file with the given filename or ID is already ready for use, meaning
   * the file exists and, optionally, the file size and/or duration is close to the given length
   * @param file - The file name to search for
   * @param id - The Spotify ID to search for
   * @param criteria - The conditions to meet
   */
  static async ready(
    file: string,
    id: string,
    criteria?: { size?: number; duration?: number }
  ): Promise<boolean> {
    const format = detectAudioFormat(file);
    const item = this.library[file] ?? this.find(id, format);

    if (item) {
      const size = await this.assertSize(item, criteria?.size);
      const duration = await this.assertDuration(item, criteria?.duration);
      return item && size && duration;
    }

    return false;
  }

  private static async assertSize(
    item: LibraryItem,
    expected?: number
  ): Promise<boolean> {
    return !isNil(expected) ? item.size >= expected : true;
  }

  private static async assertDuration(
    item: LibraryItem,
    expected?: number,
    buffer = 2000
  ): Promise<boolean> {
    if (!isNil(expected)) {
      const { duration } = await item.metadata();
      const [min, max] = [expected - buffer, expected + buffer];
      return duration >= min && duration <= max;
    }

    return true;
  }
}
