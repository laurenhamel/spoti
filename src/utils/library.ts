import { AudioFormat } from "../types/audio";
import { type SpotiOptions } from "../types/config";
import {
  type LibraryItem,
  type LibraryOptions,
  type LibraryMetadata,
  type LibraryManifest,
  type LibraryFile,
} from "../types/library";
import { type SpotifyMetadataResult } from "../types/spotify";
import { VideoFormat } from "../types/video";
import { generateTrackTag } from "../utils/tags";
import { mergeOptions } from "./action";
import { Audio } from "./audio";
import { prepareDownloadType } from "./downloads";
import { Format } from "./format";
import { Metadata } from "./metadata";
import { Progress } from "./progress";
import { pool, Deferred } from "./promise";
import { searchYoutubeType } from "./search";
import { getSpotifyType } from "./spotify";
import chalk from "chalk";
import { sync as glob } from "glob";
import { find, get, isNil, merge, pick } from "lodash-es";
import id3, { type Tags } from "node-id3";
import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";

const { Promise: ID3 } = id3;

const LIBRARY_DEFAULTS: LibraryOptions = {
  verbose: false,
  prefixes: true,
  suffixes: true,
};

export class Library {
  static dir: string = process.env.PWD ?? "";
  static library: LibraryItem[] = [];
  static files: string[] = [];

  private static __mounted = new Deferred<boolean>();

  static mounted: Promise<boolean> = this.__mounted.promise;

  private static __options: LibraryOptions = { ...LIBRARY_DEFAULTS };

  static get options(): LibraryOptions {
    return this.__options;
  }

  static set options(options: LibraryOptions) {
    this.__options = mergeOptions(this.__options, options);
  }

  /**
   * Mount the library to the given directory
   * @param dir - The root directory of the library
   */
  static async mount<TOptions extends SpotiOptions>(
    dir: string,
    options: TOptions = {} as TOptions
  ): Promise<boolean> {
    this.dir = dir;
    this.files = this.scan(this.dir);
    this.options = options as unknown as LibraryOptions;
    this.options.verbose && this.files.forEach((file) => console.log(file));
    this.library = await this.process(this.files);
    this.__mounted.resolve(true);
    return this.mounted;
  }

  /**
   * Scan the given directory for its list of files
   * @param dir - The directory to scan
   * @param format - Filter by audio or video file format
   * @returns
   */
  static scan(dir: string, format?: AudioFormat | VideoFormat): string[] {
    const patterns: string[] = [];

    if (!format || format === AudioFormat.MP3) {
      patterns.push(basename(this.path("*", AudioFormat.MP3)));
    }

    if (!format || format === VideoFormat.MP4) {
      patterns.push(basename(this.path("*", VideoFormat.MP4)));
    }

    if (!format || format === AudioFormat.M4A) {
      patterns.push(basename(this.path("*", AudioFormat.M4A)));
    }

    if (!format || format === AudioFormat.WAV) {
      patterns.push(basename(this.path("*", AudioFormat.WAV)));
    }

    if (!format || format === AudioFormat.AAC) {
      patterns.push(basename(this.path("*", AudioFormat.AAC)));
    }

    const files = patterns.flatMap((pattern) =>
      glob(pattern, {
        nodir: true,
        dot: true,
        cwd: dir,
      })
    );

    return files
      .filter((file) => !file.startsWith(".") || Format.isHidden(file))
      .map((file) => file.normalize());
  }

  /**
   * Process the metadata for the given list of files
   * @param files - The files to scan
   * @param increment - A progress increment function
   * @returns
   */
  static async process(files: string[]): Promise<LibraryItem[]> {
    const progress = new Progress({
      label: "Mounting…",
      total: files.length,
      color: chalk.blue,
    });

    const dispatch = pool(25);

    const tasks = files.map((file) => async () => {
      const result = this.parse(file);
      progress.increment();
      return result;
    });

    const metadata = await dispatch(tasks);

    progress.done();

    return metadata;
  }

  /**
   * Parse information about the given file
   * @param target - The target file to collect metadata for
   * @returns
   */
  static parse(target: string): LibraryItem {
    const file = this.file(target);
    const format = Audio.format(file);
    const title = this.title(file);
    const path = this.path(file, format);
    const size = this.size(file);
    const raw = { title, file, path, format, size };
    const metadata = this.metadata(file);
    return { title, file, path, format, size, raw, metadata };
  }

  /**
   * Create an async metadata callback for the given file
   * @param file - The file to create the metadata for
   * @returns
   */
  static metadata(file: string): () => Promise<LibraryMetadata> {
    let cached: LibraryMetadata | undefined;

    return async () => {
      if (!cached) {
        const tags = await this.meta(file);
        const duration = this.duration(file, tags);
        const id = this.id(tags);
        cached = { tags, duration, id };
      }

      return cached;
    };
  }

  /**
   * Read ID3 tags of the given file
   * @param file - The file to read tags of
   * @returns
   */
  static async meta(file: string): Promise<Tags> {
    return this.exists(file) ? ID3.read(this.path(file)) : {};
  }

  /**
   * Save ID3 tags to the given file by merging them with existing tags
   * @param file - The file to tag
   * @param tags - The tags to save
   * @param id - The Spotify ID if available
   * @param duration - The duration if available
   * @param preserve - A list of ID3 tags that should be preserved in the initial file when present
   * @returns
   */
  static async tag(
    file: string,
    tags: Tags,
    id?: string,
    duration?: number,
    preserve: (keyof Tags)[] = ["genre", "bpm", "initialKey"]
  ): Promise<void> {
    const item = this.find(file);

    if (item) {
      const path = item.raw.path;
      const previous = await ID3.read(readFileSync(path));
      const next = merge({}, previous, tags, pick(previous, ...preserve));

      this.assignId(next, id);
      this.assignDuration(next, duration);

      await ID3.update(next, path);

      this.set(file, this.parse(file));
    }
  }

  /**
   * Find the target file with the given name within the library
   * @param target - The target file to find within the library
   * @returns
   */
  static find(target: string): LibraryItem | undefined {
    let result: LibraryItem | undefined;

    for (const item of this.library) {
      const { file, path, format, raw } = item;

      if (file === target || path === target) {
        result = item;
      } else if (raw.file === target || raw.path === target) {
        result = item;
      } else if (format === Audio.format(target)) {
        const { prefix, suffix } = this.normalize(item, target);
        result = prefix || suffix ? item : undefined;
      }

      if (result) {
        break;
      }
    }

    return result;
  }

  /**
   * Find the index of the target file with the given name within the library
   * @param target - The target file to find within the library
   * @returns
   */
  static findIndex(target: string): number {
    let result: number = -1;

    for (let i = 0; i < this.library.length; i++) {
      const item = this.library[i];
      const { file, path, format, raw } = item;

      if (file === target || path === target) {
        result = i;
      } else if (raw.file === target || raw.path === target) {
        result = i;
      } else if (format === Audio.format(target)) {
        const { prefix, suffix } = this.normalize(item, target);
        result = prefix || suffix ? i : result;
      }

      if (result > -1) {
        break;
      }
    }

    return result;
  }

  private static normalize(
    item: LibraryItem,
    target: string
  ): {
    prefix?: string;
    suffix?: string;
    base: string;
  } {
    const title = this.title(target);

    let base: string = item.title;
    let prefix: string | undefined;
    let suffix: string | undefined;

    if (base.includes(title)) {
      const start = base.indexOf(title);
      const end = start + title.length;
      prefix = base.slice(0, start);
      suffix = base.slice(end);
      base = base.slice(start, end);
    }

    prefix = prefix?.length === 0 ? undefined : prefix;
    suffix = suffix?.length === 0 ? undefined : suffix;

    if (base !== item.title) {
      item.title = base;
      item.file = this.file(base, item.format);
      item.path = this.path(base, item.format);
    }

    return { base, prefix, suffix };
  }

  /**
   * Get metadata from the library
   * @param target - The target file to get metadata for
   * @returns
   */
  static get(target: string): LibraryItem | undefined {
    return this.find(target);
  }

  /**
   * Set metadata in the library
   * @param file - The file to set metdata for
   * @param value - The metadata to set
   */
  static set(file: string, metadata: LibraryItem): number {
    const index = this.findIndex(file);

    if (index > -1) {
      this.library[index] = metadata;
      return index;
    } else {
      this.library.push(metadata);
      return this.library.length - 1;
    }
  }

  /**
   * Determine if metadata exist in the library
   * @param file - The file to search for
   * @returns
   */
  static has(file: string): boolean {
    return !!this.get(file);
  }

  static readonly ID = "spoti.id" as const;

  /**
   * Add Spotify ID metadata as an ID3 tag
   * @param tags - The tags to assign to
   * @param id - The Spotify ID to assign
   */
  static assignId(tags: Tags, id?: string): void {
    if (id) {
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
  }

  static readonly DURATION = "spoti.duration" as const;

  /**
   * Add duration metadata as an ID3 tag
   * @param tags - The tags to assign to
   * @param duration - The duration to assign
   */
  private static assignDuration(tags: Tags, duration?: number): void {
    if (duration) {
      const value = duration.toString();

      if (tags.userDefinedText) {
        const meta = find(tags.userDefinedText, { description: this.DURATION });

        if (meta) {
          meta.value = value;
        } else {
          tags.userDefinedText.push({ description: this.DURATION, value });
        }
      } else {
        tags.userDefinedText = [{ description: this.DURATION, value }];
      }
    }
  }

  /**
   * Get the absolute path of the given file within the library
   * @param file - The file to retrieve an absolute path for
   * @param format - The expected format of the file
   * @returns
   */
  static path(file: string, format?: AudioFormat | VideoFormat): string {
    const ext = extname(file);
    const base = basename(file, ext);
    const extension = format ? `.${format}` : ext;
    const filename = base + extension;
    return join(this.dir, filename);
  }

  /**
   * Get the file name from the given file path
   * @param path - The path to get the file name from
   * @param format - The expected format of the file
   * @returns
   */
  static file(path: string, format?: AudioFormat | VideoFormat): string {
    return basename(this.path(path, format));
  }

  /**
   * Extract the title from the given file
   * @param file - The file to extract the title from
   * @returns
   */
  static title(file: string): string {
    return basename(file, extname(file));
  }

  /**
   * Create a new writable file audio stream using the given filename
   * @param file - The filename to use for the write stream
   * @param format - The expected format of the file
   * @returns
   */
  static new(
    dest: string,
    format = Audio.format(dest)
  ): {
    path: string;
    file: string;
    title: string;
    format: AudioFormat | VideoFormat;
    write: (chunk: unknown) => void;
    save: () => Promise<void>;
  } {
    const file = this.file(dest, format);
    const path = this.path(dest, format);
    const chunks: unknown[] = [];
    const stream = createWriteStream(path);
    const deferred = new Deferred();

    const write = (chunk: unknown): void => {
      chunks.push(chunk);
    };

    const clean = (): void => {
      if (Library.exists(file) && Library.size(file) === 0) {
        Library.remove(file);
      }
    };

    const save = async (): Promise<void> => {
      await deferred.promise;

      for (const chunk of chunks) {
        const done = new Deferred();
        stream.write(chunk, () => done.resolve());
        await done.promise;
      }

      stream.end();
    };

    stream.on("open", deferred.resolve);
    stream.on("error", clean);

    // @FIXME Why does this not work?
    process.on("SIGINT", clean);
    process.on("SIGQUIT", clean);
    process.on("SIGTERM", clean);

    return {
      file,
      path,
      title: this.title(file),
      format,
      write,
      save,
    };
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
    return !!this.find(file);
  }

  /**
   * Get the size of a file in bytes
   * @param file - The file to retrieve the size of
   * @returns
   */
  static size(file: string): number {
    return this.exists(file) ? statSync(this.path(file)).size : 0;
  }

  /**
   * Get the duration of a file in milliseconds (ms)
   * @param file - The file to retrieve the duration for
   * @param tags - The ID3 tags of the file if available
   * @param duration - The precomputed duration if available
   * @returns
   */
  static duration(file: string, tags?: Tags, value = 0): number {
    // prettier-ignore
    const name = '"' + this.file(file).replace(/"/g, '\\"') + '"';

    let duration = value;

    if (!duration && tags) {
      const data = get(tags, "userDefinedText", []);
      const value = find(data, { description: this.DURATION })?.value;
      duration = value ? parseFloat(value) : duration;
    }

    if (!duration && this.exists(file)) {
      const { stdout } = spawnSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          `${name}`,
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
   * Extract a Spotify ID from ID3 tags if available
   * @param tags - The ID3 tags of the file
   * @returns
   */
  static id(tags: Tags): string | undefined {
    const data = get(tags, "userDefinedText", []);
    return find(data, { description: this.ID })?.value;
  }

  /**
   * Find the M4A/MP4 source file for an MP3 file
   * @param file - The file to use to look for a source file
   * @returns
   */
  static source(file: string): string {
    const files = [
      Format.hide(this.file(file, AudioFormat.M4A)),
      Format.hide(this.file(file, VideoFormat.MP4)),
    ];

    for (const file of files) {
      if (this.exists(file)) {
        return file;
      }
    }

    return files[0];
  }

  /**
   * Determine if a file with the given filename is already ready to use, meaning
   * the file exists and, optionally, the file size and/or duration reflects the given value.
   * @param file - The file to search for
   * @param criteria - The conditions to meet
   */
  static async ready(
    file: string,
    criteria?: { size?: number; duration?: number }
  ): Promise<boolean> {
    const item = this.get(file);

    if (item) {
      const size = await this.assertSize(item, criteria?.size);
      const duration = await this.assertDuration(item, criteria?.duration);
      return size && duration;
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

  /**
   * Generates a manifest of library information
   * @param file - An optional MP3 file or Spoti metadata file to use as an entrypoint
   * @returns
   */
  static async manifest<TOptions extends SpotiOptions>(
    file?: string,
    options?: TOptions
  ): Promise<LibraryManifest> {
    const files: LibraryFile[] = [];

    // MP3 file
    if (file && Library.exists(file)) {
      files.push(Library.parse(file));
    }

    // Spoti metadata file (`*.spoti`)
    else if (file && Metadata.has(file)) {
      const { id, type } = Metadata.read<SpotifyMetadataResult>(file);
      const data = await getSpotifyType(id, type, options);
      const results = await searchYoutubeType(type, data, options);
      const prepared = prepareDownloadType(type, data, results, options);

      for (const item of prepared) {
        const id = item.item.id;
        const duration = item.item.duration_ms;
        const tags = await generateTrackTag(item);

        files.push({
          ...Library.parse(item.download.file),
          item,
          id,
          tags,
          duration,
        });
      }
    }

    // No file, defaults to using library as is
    else {
      files.push(...Library.library);
    }

    return { files };
  }
}
