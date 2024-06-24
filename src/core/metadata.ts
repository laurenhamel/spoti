import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { Library } from "../utils";

export class Metadata {
  static file(name: string): string {
    const base = basename(name, extname(name));
    return base + ".spoti";
  }

  static path(name: string): string {
    return join(Library.dir, this.file(name));
  }

  static has(name: string): boolean {
    return existsSync(this.path(name));
  }

  static save<TData = any>(name: string, data: TData) {
    const json = JSON.stringify(data, null, 2);
    writeFileSync(this.path(name), json);
  }

  static read<TData = any>(name: string): TData {
    const data = readFileSync(this.path(name), { encoding: "utf-8" });
    return JSON.parse(data) as TData;
  }
}
