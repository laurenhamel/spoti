import { Youtube } from "../models";
import {
  createWriteStream,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { sync as glob } from "glob";
import { Audio } from "./audio";
import id3, { type Tags } from "node-id3";
import { find, findIndex, get, isNil, merge } from "lodash-es";
import { spawnSync } from "node:child_process";
import { pool, Deferred } from "./promise";
import { Progress } from "./progress";
import chalk from "chalk";
import { Format } from "./format";
import { AudioFormat, SpotiOptions, VideoFormat } from "../types";

const { Promise: ID3 } = id3;

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

export class Library {
  static dir: string = process.env.PWD ?? "";
  static library: LibraryItem[] = [];
  static files: string[] = [];

  private static mounted$ = new Deferred<boolean>();

  static mounted: Promise<boolean> = this.mounted$.promise;

  static options$: LibraryOptions = {
    verbose: false,
    prefixes: true,
    suffixes: true,
  };

  static get options(): LibraryOptions {
    return this.options$;
  }

  static set options(options: LibraryOptions) {
    this.options$ = merge(
      {
        verbose: false,
        prefixes: true,
        suffixes: true,
      },
      options
    );
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
    this.library = await this.hydrate(this.files);
    this.mounted$.resolve(true);
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

    return files.map((file) => file.normalize());
  }

  /**
   * Hydrate the metadata for the given list of files
   * @param files - The files to scan
   * @param increment - A progress increment function
   * @returns
   */
  static async hydrate(files: string[]): Promise<LibraryItem[]> {
    const progress$ = new Progress(
      "Mounting…",
      {
        type: "percentage",
        percentage: 0,
        message: `0 / ${files.length}`,
        nameTransformFn: chalk.blue,
      },
      (() => {
        let reports = 0;
        return () => {
          reports++;
          const percentage = reports / files.length;
          const message = `${reports} / ${files.length}`;
          progress$.update(percentage, message);
        };
      })()
    );

    const dispatch = pool(25);

    const tasks = files.map((file) => async () => {
      const result = this.parse(file);
      progress$.report();
      return result;
    });

    const metadata = await dispatch(tasks);

    progress$.done();
    progress$.remove();

    return metadata;
  }

  /**
   * Parse information about the given file
   * @param file - The file to collect metadata for
   * @returns
   */
  static parse(file: string): LibraryItem {
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
   * Save ID3 tags to the given file
   * @param file - The file to tag
   * @param tags - The tags to save
   * @param id - The Spotify ID if available
   * @param duration - The duration if available
   * @returns
   */
  static async tag(
    file: string,
    tags: Tags,
    id?: string,
    duration?: number
  ): Promise<void> {
    if (this.exists(file)) {
      const path = this.path(file);

      this.assignId(tags, id);
      this.assignDuration(tags, duration);

      await ID3.write(tags, path);

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
      const { file, path, format } = item;

      if (file === target || path === target) {
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
  static set(file: string, metadata: LibraryItem): void {
    const path = this.path(file);
    const index =
      findIndex(this.library, { file }) ?? findIndex(this.library, { path });

    if (index > -1) {
      this.library[index] = metadata;
    } else {
      this.library.push(metadata);
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
  private static assignId(tags: Tags, id?: string): void {
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
   * @param file - The file to retreive the size of
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
}
