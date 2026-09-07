import { type SpotiMetadata } from "../types/metadata";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

export class Metadata {
  static dir: string = process.env.PWD ?? "";

  static file(name: string): string {
    const base = basename(name, extname(name));
    return base + ".spoti";
  }

  static path(name: string): string {
    return join(this.dir, this.file(name));
  }

  static has(name: string): boolean {
    return existsSync(this.path(name));
  }

  static save<TMetadata extends SpotiMetadata>(name: string, data: TMetadata) {
    const json = JSON.stringify(data, null, 2);
    writeFileSync(this.path(name), json);
  }

  static read<TMetadata extends SpotiMetadata>(name: string): TMetadata {
    const metadata = readFileSync(this.path(name), { encoding: "utf-8" });
    return JSON.parse(metadata) as TMetadata;
  }
}
