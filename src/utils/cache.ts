import {
  readdirSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { trimStart, zip, zipObject, merge, isArray, isObject } from "lodash-es";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CACHE_DIR = resolve(__dirname, "../../.spoti/cache");

export class Cache {
  readonly dir: string;
  readonly ext: string;

  constructor(dir: string = DEFAULT_CACHE_DIR, ext: string = "json") {
    this.dir = dir;
    this.ext = trimStart(ext.toLowerCase(), ".");
    !existsSync(this.dir) && mkdirSync(this.dir, { recursive: true });
  }

  private get parse(): (value: string) => string {
    return this.ext === "json" ? JSON.parse : (value: string) => value;
  }

  private get stringify(): (value: any) => string {
    return this.ext === "json"
      ? JSON.stringify
      : (value: any) => value.toString();
  }

  private merge(value: any, data: any): any {
    return isArray(value)
      ? [...value, ...data]
      : isObject(value)
      ? merge({}, value, data)
      : value + data;
  }

  private sanitize(key: string): string {
    return key.replace(/[:]/g, "__");
  }

  private read(key: string): any {
    const file = join(this.dir, `${this.sanitize(key)}.${this.ext}`);
    return this.parse(readFileSync(file, { encoding: "utf-8" }));
  }

  private save(key: string, value: any): void {
    const file = join(this.dir, `${this.sanitize(key)}.${this.ext}`);
    writeFileSync(file, this.stringify(value));
  }

  get keys(): string[] {
    const files = readdirSync(this.dir, { encoding: "utf-8" });
    return files.map((file) => basename(file, `.${this.ext}`));
  }

  get values(): any[] {
    return this.keys.map((key) => this.read(key));
  }

  get entries(): [string, any][] {
    return zip(this.keys, this.values) as [string, any][];
  }

  get data(): Record<string, any> {
    return zipObject(this.keys, this.values);
  }

  has(key: string): boolean {
    return this.keys.includes(this.sanitize(key));
  }

  get<TType = any>(key: string): TType | undefined {
    return this.has(key) ? this.read(key) : undefined;
  }

  set(key: string, value: any): void {
    this.save(key, value);
  }

  update(key: string, value: any): void {
    this.save(key, this.merge(this.get(key), value));
  }
}

export const cache = new Cache();
