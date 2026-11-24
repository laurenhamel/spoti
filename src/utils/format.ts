/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Spotify } from "../models";
import { AudioFormat } from "../types/audio";
import { compact, map, padStart, padEnd, trimStart, isNaN, isString, isEmpty, isArray, trimEnd, get } from "lodash-es";
import { dirname, basename, join, extname } from "node:path";
import size from "pretty-bytes";
import duration from "pretty-ms";
import { type MaybeLibraryFile } from "../types/library";

const DEFAULT_PLACEHOLDER_DELIMITER = '|';

export class Format {
  /**
   * The album name of the Spotify track.
   * @example PRISM
   */
  static ALBUM = "{album}" as const;

  /**
   * The primary album artist of the Spotify track.
   * @example Katy Perry
   */
  static ALBUM_ARTIST = "{album-artist}" as const;

  /**
   * The list of album artists of the Spotify track.
   * @example Katy Perry
   */
  static ALBUM_ARTISTS = "{album-artists}" as const;

  /**
   * The primary artist of the Spotify track.
   * @example Katy Perry
   */
  static ARTIST = "{artist}" as const;

  /**
   * The list of artists of the Spotify track.
   * @example Katy Perry, Juicy J
   */
  static ARTISTS = "{artists}" as const;

  /**
   * The duration of the Spotify track formatted as mm:ss.ms.
   * @example 02:10.05
   */
  static DURATION = "{duration}" as const;

  /**
   * The extension of the audio file, excluding the dot prefix
   * @example mp3
   */
  static EXT = "{ext}" as const;

  /**
   * The primary genre of the Spotify track's primary artist.
   * @example Dance Pop
   */
  static GENRE = "{genre}" as const;

  /**
   * The list of genres of the Spotify track's primary artist.
   * @example Dance Pop, Pop
   */
  static GENRES = "{genres}" as const;

  /**
   * The Spotify track ID.
   * @example 4jbmgIyjGoXjY01XxatOx6
   */
  static ID = "{id}" as const;

  /**
   * The International Standard Recording Code of the Spotify track.
   * @example USUM71311296
   */
  static ISRC = "{isrc}" as const;

  /**
   * The song title of the Spotify track.
   * @example Dark Horse
   */
  static SONG = "{song}" as const;

  /**
   * The song number of the Spotify track within the album.
   * @example 06
   */
  static TRACK_NUMBER = "{track-number}" as const;

  /**
   * The release year of the Spotify track.
   * @example 2013
   */
  static YEAR = "{year}" as const;

  /**
   * The current file name
   */
  static FILE = "{file}" as const;

  /**
   * The default format to use for all Spotify track file names
   */
  static format = `${Format.ARTISTS} - ${Format.SONG}.${Format.EXT}`;

  private static extractors: Record<
    string,
    (track: Spotify.Track) => string | undefined
  > = {
    [Format.ALBUM]: this.getAlbum,
    [Format.ALBUM_ARTIST]: this.getAlbumArtist,
    [Format.ALBUM_ARTISTS]: this.getAlbumArtists,
    [Format.ARTIST]: this.getArtist,
    [Format.ARTISTS]: this.getArtists,
    [Format.DURATION]: this.getDuration,
    [Format.EXT]: this.getExt,
    [Format.GENRE]: this.getGenre,
    [Format.GENRES]: this.getGenres,
    [Format.ID]: this.getId,
    [Format.ISRC]: this.getIsrc,
    [Format.SONG]: this.getSong,
    [Format.TRACK_NUMBER]: this.getTrackNumber,
    [Format.YEAR]: this.getYear,
    [Format.FILE]: this.getFile,
  };

  /**
   * Extracts data for placeholders in the given format from the given Spotify track information
   */
  static extract(format: string, track: Spotify.Track): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const placeholders = Array.from(format.matchAll(/(\{.+?\})/g));

    for (const [placeholder] of placeholders) {
      const [key] = trimEnd(trimStart(placeholder, '{'), '}').split(':');
      const normalized = `{${key}}`;
      const extractor = this.extractors[normalized];
      data[key] = extractor?.(track);
    }

    return data;
  }

  /**
   * Determines whether a given format is valid
   * @param format - The format string to check
   * @param allowed - An additional list of allowed placeholders
   * @param delimiter - The placeholder delimiter
   * @returns
   */
  static valid(format: string, allowed: `{${string}}`[] = [], delimiter: string = DEFAULT_PLACEHOLDER_DELIMITER): boolean {
    const placeholders = Array.from(format.matchAll(/(\{.+?\})/g));

    // Requires that at least one placeholder is present
    if (!placeholders.length) return false;

    const base = Object.keys(this.extractors);
    const expected = [...base, ...allowed];

    // Requires that only supported placeholders are used
    for (const [placeholder] of placeholders) {
      const [key] = trimEnd(trimStart(placeholder, '{'), '}').split(delimiter);
      const normalized = `{${key}}`;
      if (!expected.includes(normalized)) return false;
    }

    return true;
  }

  /**
   * Applies a placeholder pattern filter against a given data value
   * @remarks Only applies to string values or arrays with string values
   * @param value - The data value to try filtering against
   * @param pattern - Some regular expression pattern use for filtering
   * @returns
   */
  private static filter(value: any, pattern?: string): any {
    if (!pattern) return value;

    const regex = new RegExp(pattern, 'i');

    if (isString(value)) {
      return regex.test(value) ? value : undefined;
    }

    if (isArray(value)) {
      return value.filter(item =>isString(item) && regex.test(item));
    }

    return value;
  }

  /**
   * Gets a placeholder value from the given data set
   * @remarks Supports placeholders in the format of `{<placeholder>(|<path>)?(|<pattern>)?}`.
   * @param placeholder - The placeholder value to get
   * @param data - The data set to use to get the placeholder value
   * @param delimiter - The placeholder delimiter
   * @returns
   */
  private static get(placeholder: string, data: Record<string, unknown>, delimiter: string = DEFAULT_PLACEHOLDER_DELIMITER): [any, string, string?, string?] {
    const [key, path, pattern] = trimEnd(trimStart(placeholder, '{'), '}').split(delimiter);
    const source = get(data, key);
    const filtered = this.filter(source, pattern);
    const value = !isEmpty(path) ? get(filtered, path) : filtered;
    return [value, key, path, pattern];
  }

  /**
   * Inspects whether format placeholders would be replaced with the given data
   * @param format - The format to follow
   * @param data - The data to use to replace placeholders
   * @param delimiter - The placeholder delimiter
   * @returns
   */
  static inspect(format: string, data: Record<string, unknown>, delimiter: string = DEFAULT_PLACEHOLDER_DELIMITER): Record<string, boolean> {
    const placeholders = Array.from(format.matchAll(/(\{.+?\})/g));
    const result: Record<string, boolean> = {};

    for (const [placeholder] of placeholders) {
      const [value] = this.get(placeholder, data, delimiter);
      const exists = Boolean(value);
      result[placeholder] = exists;
    }

    return result;
  }

  /**
   * Replaces format placeholders using the given data
   * @param format - The format to follow
   * @param data - The data to use to replace placeholders
   * @param sanitize - Whether to sanitize the data
   * @param delimiter - the placeholder delimiter
   * @returns
   */
  static replace(format: string, data: Record<string, unknown>, sanitize: boolean = true, delimiter: string = DEFAULT_PLACEHOLDER_DELIMITER): string {
    const replaceIn = (initial: string): string => {
      const placeholders = Array.from(initial.matchAll(/(\{.+?\})/g));

      let result = initial;

      for (const [placeholder] of placeholders) {
        const [value] = this.get(placeholder, data, delimiter);
        result = result.replaceAll(placeholder, value);
      }

      return result;
    };

    let [title, extension] = format.split(".");

    title = replaceIn(title);
    extension = extension ? '.' + replaceIn(extension) : '';

    if (sanitize) {
      title = this.sanitize(title);
      extension = this.sanitize(extension);
    }

    return `${title}${extension}`;
  }

  /**
   * Build the file name of a Spotify track using the given format
   */
  static file(
    track: Spotify.Track,
    ext: AudioFormat,
    format = this.format
  ): string {
    this.ext = ext;
    const data = this.extract(format, track);
    return this.replace(format, data);
  }

  /**
   * Get the album name of the Spotify track.
   */
  static getAlbum(track: Spotify.Track): string {
    return track.album.name;
  }

  /**
   * Get the primary album artist of the Spotify track.
   */
  static getAlbumArtist(track: Spotify.Track): string {
    return track.album.artists[0].name;
  }

  /**
   * Get the list of album artists of the Spotify track.
   */
  static getAlbumArtists(track: Spotify.Track): string {
    return map(track.album.artists, "name").join(", ");
  }

  /**
   * Get the primary artist of the Spotify track.
   */
  static getArtist(track: Spotify.Track): string {
    return track.artists[0].name;
  }

  /**
   * Get the list of artists of the Spotify track.
   */
  static getArtists(track: Spotify.Track, separator = ", "): string {
    return map(track.artists, "name").join(separator);
  }

  /**
   * Formats some given milliseconds into a pretty duration timestamp like `m:ss`
   * @param ms - The duration in milliseconds
   * @returns
   */
  static duration(ms: number = 0): string {
    const raw = isNaN(ms) ? 0 : ms;

    return duration(raw, {
      colonNotation: true,
      secondsDecimalDigits: 0,
      millisecondsDecimalDigits: 0,
    });
  }

  /**
   * Get the duration of the Spotify track.
   */
  static getDuration(track: Spotify.Track): string {
    return this.duration(track.duration_ms);
  }

  private static ext: AudioFormat = AudioFormat.MP3;

  /**
   * Get the extension of the audio file.
   */
  static getExt(): AudioFormat {
    return this.ext;
  }

  /**
   * Get the primary genre for the primary artist of the Spotify track.
   */
  static getGenre(track: Spotify.Track): string {
    return track.artists[0].genres[0];
  }

  /**
   * Get the list of genres from the primary artist of Spotify track.
   */
  static getGenres(track: Spotify.Track, separator = ", "): string {
    return track.artists[0].genres.join(separator);
  }

  /**
   * Get the ID of the Spotify track.
   */
  static getId(track: Spotify.Track): string {
    return track.id;
  }

  /**
   * Get the ISRC of the Spotify track.
   */
  static getIsrc(track: Spotify.Track): string | undefined {
    return track.external_ids.isrc;
  }

  /**
   * Get the song title of the Spotify track.
   */
  static getSong(track: Spotify.Track): string {
    return track.name;
  }

  /**
   * Get the song number of the Spotify track.
   */
  static getTrackNumber(track: Spotify.Track): string {
    return padStart(track.track_number.toString(), 2, "0");
  }

  /**
   * Get the release year of the Spotify track.
   */
  static getYear(track: Spotify.Track): string {
    return track.album.release_date.split("-")[0];
  }

  /**
   * Gets the current file name if/when library data is available.
   */
  static getFile(track: MaybeLibraryFile<Spotify.Track>): string | undefined {
    return track.library?.file;
  }

  static DIRTY_CHARACTERS = {
    Á: "Á",
    À: "À",
    Ä: "Ä",
    É: "É",
    Í: "Í",
    Ö: "Ö",
    Ü: "Ü",
    á: "á",
    ä: "ä",
    é: "é",
    è: "è",
    ê: "ê",
    ë: "ë",
    í: "í",
    ì: "ì",
    ï: "ï",
    ñ: "ñ",
    ó: "ó",
    ô: "ô",
    ö: "ö",
    ú: "ú",
    $: "S",
    "“": '"',
    "”": '"',
    ".": "",
    "/": "",
    "\\": "",
    ":": "",
    "’": "'",
    "€": "E",
  } as const;

  /**
   * Sanitize the given file name, removing unsupported characters
   */
  static sanitize(file: string): string {
    let sanitized = file;

    for (const entry in this.DIRTY_CHARACTERS) {
      const key = entry as keyof typeof this.DIRTY_CHARACTERS;
      const chars = entry.split("");
      const pattern = chars.map((char) => `\\${char}`).join("");
      const regex = new RegExp(pattern, "g");
      const replacement = this.DIRTY_CHARACTERS[key];
      sanitized = sanitized.replace(regex, replacement);
    }

    sanitized = sanitized.replace(/ {2,}/g, " ");

    return sanitized;
  }

  static HIDDEN_FILE_PREFIX = "." as const;

  static HIDDEN_FILE_SUFFIX = ".spoti" as const;

  /**
   * Determines if the given filename is a hidden Spoti file
   * @param file - The filename to check
   */
  static isHidden(file: string): boolean {
    const root = basename(file);
    const [_base, ...exts] = trimStart(root, ".").split(".");
    const ext = "." + exts.join(".");

    return (
      root.startsWith(Format.HIDDEN_FILE_PREFIX) &&
      ext.startsWith(Format.HIDDEN_FILE_SUFFIX)
    );
  }

  /**
   * Parses the given file basename to its different parts
   */
  static parse(file: string): {
    prefix?: string;
    base: string;
    ext: string;
    suffix?: string;
  } {
    const input = basename(file);
    const prefix = Format.isHidden(input) ? this.HIDDEN_FILE_PREFIX : undefined;
    const clean = trimStart(input, this.HIDDEN_FILE_PREFIX);
    const [base, ...exts] = basename(clean).split(".");
    const first = "." + exts[0];
    const suffix = first === this.HIDDEN_FILE_SUFFIX ? first : undefined;
    const ext = "." + (suffix ? exts.slice(1) : exts).join(".");
    return { prefix, base, ext, suffix };
  }

  /**
   * Converts the parse object back to a file basename
   */
  static unparse({
    prefix,
    base,
    ext,
    suffix,
  }: {
    prefix?: string;
    base: string;
    ext: string;
    suffix?: string;
  }): string {
    return compact([prefix, base, suffix, ext]).join("");
  }

  /**
   * Convert the given filename to a hidden file format
   */
  static hide(file: string): string {
    const dir = dirname(file);
    const [base, ...exts] = basename(file).split(".");
    const ext = "." + exts.join(".");
    const extension = this.HIDDEN_FILE_SUFFIX + ext;
    const hidden = this.HIDDEN_FILE_PREFIX + base;
    const filename = hidden + extension;
    return join(dir, filename);
  }

  /**
   * Convert the given filename from a hidden file format
   */
  static unhide(file: string): string {
    const dir = dirname(file);
    const [base, ...exts] = basename(file).split(".");
    const ext = "." + exts.join(".");
    const extension = ext !== this.HIDDEN_FILE_SUFFIX ? ext : "";
    const trimmed = trimStart(base, this.HIDDEN_FILE_PREFIX);
    const cleaned = basename(trimmed, this.HIDDEN_FILE_SUFFIX);
    const filename = cleaned + extension;
    return join(dir, filename);
  }

  /**
   * Truncate and/or pad the filename to the given length, keeping the extension intact
   */
  static truncateFile(
    file: string,
    length: number,
    sanitize: boolean = false
  ): string {
    // Truncate
    if (file.length > length) {
      const ext = extname(file);
      const base = basename(file, ext);
      const clamp = length - ext.length - 1;
      const truncated = base.substring(0, clamp);
      const sanitized = sanitize ? this.sanitize(truncated) : truncated;
      return sanitized + "…" + ext;
    }

    // Pad
    const sanitized = sanitize ? this.sanitize(file) : file;
    return padEnd(sanitized, length, " ");
  }

  /**
   * Truncate and/or pad the text to the given length
   */
  static truncateText(
    text: string,
    length: number,
    sanitize: boolean = false
  ): string {
    // Truncate
    if (text.length > length) {
      const truncated = text.substring(0, length - 1);
      const sanitized = sanitize ? this.sanitize(truncated) : truncated;
      return sanitized + "…";
    }

    // Pad
    const sanitized = sanitize ? this.sanitize(text) : text;
    return padEnd(sanitized, length, " ");
  }

  /**
   * Formats bytes to use a pretty extension
   * @param bytes
   * @returns
   */
  static bytes(bytes: number): string {
    return size(bytes, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      space: false,
    });
  }
}
