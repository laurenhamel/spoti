import { Youtube } from "../models";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, parse } from "node:path";
import { sync as glob } from "glob";
import { detectAudioFormat } from "./audio";
import { cleanFileName, getFilePath, sanitizeFileName } from "./file";
import { SpotiOptions } from "../types";
import id3, { type Tags } from "node-id3";
import { find } from "lodash-es";

const { Promise: ID3 } = id3;

export class Library {
  static dir = process.env.PWD ?? "";

  library: Record<string, Tags> = {};

  constructor(options?: SpotiOptions) {
    if (options?.pwd) {
      this.dir(options.pwd);
    } else {
      this.scanTags().then((tags) => {
        this.library = tags;
      });
    }
  }

  async dir(value: string): Promise<void> {
    Library.dir = value;
    const tags = await this.scanTags();
    this.library = tags;
  }

  files(format?: Youtube.AudioFormat): string[] {
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
        cwd: Library.dir,
      })
    );
  }

  titles(format?: Youtube.AudioFormat): string[] {
    return this.files(format).map(this.title);
  }

  async scanTags(format?: Youtube.AudioFormat): Promise<Record<string, Tags>> {
    const promises: Promise<void>[] = [];
    const result: Record<string, Tags> = {};

    for (const file of this.files(format)) {
      promises.push(
        new Promise<void>(async (resolve) => {
          result[file] = await this.readTags(file);
          resolve();
        })
      );
    }

    await Promise.all(promises);

    return result;
  }

  title(file: string): string {
    const { base } = parse(file);
    return sanitizeFileName(cleanFileName(base));
  }

  file(file: string, format = detectAudioFormat(file)): string {
    return getFilePath(file, format);
  }

  path(file: string, format?: Youtube.AudioFormat): string {
    return join(Library.dir, this.file(file, format));
  }

  new(file: string): ReturnType<typeof createWriteStream> {
    return createWriteStream(this.path(file));
  }

  read(file: string): string {
    return readFileSync(this.path(file), { encoding: "utf-8" });
  }

  save(file: string, data: Buffer | string): void {
    writeFileSync(this.path(file), data);
  }

  remove(file: string): void {
    rmSync(this.path(file));
  }

  exists(file: string): boolean {
    return existsSync(this.path(file));
  }

  size(file: string): number {
    return statSync(this.path(file)).size;
  }

  legit(file: string, size: number = 1): boolean {
    return this.exists(file) && this.size(file) >= size;
  }

  source(file: string): string {
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

  async saveTags(file: string, id: string, tags: Tags): Promise<boolean> {
    const identity = { description: "spoti.id", value: id };

    let { userDefinedText } = tags;

    if (!userDefinedText) {
      userDefinedText = [identity];
    } else if (!find(userDefinedText, identity)) {
      userDefinedText.push(identity);
    }
    const data = { ...tags, userDefinedText };
    const path = this.file(file);

    this.library[file] = data;

    return ID3.write(data, this.path(path));
  }

  async readTags(file: string): Promise<Tags> {
    return ID3.read(this.path(file));
  }

  tags(format?: Youtube.AudioFormat): Record<string, Tags> {
    const result: Record<string, Tags> = { ...this.library };

    if (format) {
      for (const file in result) {
        if (format !== detectAudioFormat(file)) {
          delete result[file];
        }
      }
    }

    return result;
  }

  find(id: string, format?: Youtube.AudioFormat): string | undefined {
    const identify = { description: "spoti.id", value: id };
    const tags = this.tags(format);

    for (const file in tags) {
      const data = tags[file];
      const custom = data.userDefinedText ?? [];

      if (find(custom, identify)) {
        return file;
      }
    }
  }
}

export const library = new Library();
