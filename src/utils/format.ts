import { Spotify, Youtube } from "../models";
import { compact, map, padStart, padEnd, trimStart } from "lodash-es";
import { dirname, basename, join, extname } from "node:path";
import { Duration } from "./duration";

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
   * The default format to use for all Spotify track file names
   */
  static format = `${Format.ARTISTS} - ${Format.SONG}.${Format.EXT}`;

  /**
   * Build the file name of a Spotify track using the given format
   */
  static file(
    track: Spotify.Track,
    ext: Youtube.AudioFormat,
    format = this.format
  ): string {
    const handlers: Record<
      string,
      (track: Spotify.Track) => string | undefined
    > = {
      [Format.ALBUM]: this.getAlbum,
      [Format.ALBUM_ARTIST]: this.getAlbumArtist,
      [Format.ALBUM_ARTISTS]: this.getAlbumArtists,
      [Format.ARTIST]: this.getArtist,
      [Format.ARTISTS]: this.getArtists,
      [Format.DURATION]: this.getDuration,
      [Format.EXT]: this.getExt(ext),
      [Format.GENRE]: this.getGenre,
      [Format.GENRES]: this.getGenres,
      [Format.ID]: this.getId,
      [Format.ISRC]: this.getIsrc,
      [Format.SONG]: this.getSong,
      [Format.TRACK_NUMBER]: this.getTrackNumber,
      [Format.YEAR]: this.getYear,
    };

    const populate = (value: string): string | undefined => {
      const handler = handlers[value] ?? (() => value);
      return handler(track);
    };

    const [base, ...exts] = format.split(".");
    const parts = base.split(" ");
    const title = this.sanitize(compact(parts.map(populate)).join(" "));
    const extension = compact(exts.map(populate)).join(".");

    return `${title}.${extension}`;
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
   * Get the duration of the Spotify track.
   */
  static getDuration(track: Spotify.Track): string {
    return Duration.format(track.duration_ms);
  }

  /**
   * Get the extension of the audio file.
   */
  static getExt(ext: Youtube.AudioFormat): () => string {
    return () => ext;
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
  static truncate(file: string, length: number): string {
    // Truncate
    if (file.length > length) {
      const ext = extname(file);
      const base = basename(file, ext);
      const clamp = length - ext.length - 1;
      const truncated = base.substring(0, clamp);
      return truncated + "…" + ext;
    }

    // Pad
    return padEnd(file, length, " ");
  }
}
