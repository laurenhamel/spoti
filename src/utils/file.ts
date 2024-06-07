import { Youtube } from "../models";
import { basename, join, parse } from "path";
import { castArray, trimStart } from "lodash-es";

export const HIDDEN_FILE_PREFIX = ".";
export const HIDDEN_FILE_SUFFIX = ".spoti";

export function getFilePath(
  segments: string | string[],
  format: Youtube.AudioFormat
): string {
  const path = join(...castArray(segments));
  const { dir, base, ext } = parse(path);
  const clean = cleanFileName(basename(base, ext));
  const title = sanitizeFileName(clean);
  const prefix = format === Youtube.AudioFormat.MP3 ? "" : HIDDEN_FILE_PREFIX;
  const suffix = format === Youtube.AudioFormat.MP3 ? "" : HIDDEN_FILE_SUFFIX;
  return join(dir, `${prefix}${title}${suffix}.${format}`);
}

export function cleanFileName(base: string): string {
  return basename(trimStart(base, HIDDEN_FILE_PREFIX), HIDDEN_FILE_SUFFIX);
}

export function sanitizeFileName(name: string): string {
  const replacemnts = {
    "\\.": "",
    " \\/ ": " ",
    "\\/": "",
    " \\\\ ": " ",
    "\\\\": "",
    ":": "",
    // prettier-ignore
    "\\$": "S",
    // prettier-ignore
    "\\€": "E",
  };

  let sanitized = name;

  for (const pattern in replacemnts) {
    const regex = new RegExp(pattern, "g");
    const replacement = replacemnts[pattern as keyof typeof replacemnts];
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}
