# `spoti`

> Yet another Spotify music downloader

## Overview

Spoti is a CLI tool that allows you to download Spotify tracks and playlists and manage your music library. Use Spoti to download or sync music, get information about a Spotify URL, search YouTube for one or more Spotify tracks, tag or sanitize your music library, and more. See the [usage](#usage) guide for more details. Downloading works by:

1. Retrieving information from Spotify for the desired track(s)
2. Searching for the matching track(s) on YouTube Music
3. Downloading the track(s) from YouTube via `yt-dlp`
4. Converting the track(s) to `*.mp3` file(s) (or your preferred audio format) via `ffmpeg`
5. Adding ID3v2 tags to all track(s) using the Spotify information

## Prerequisites

- `node` (>=26)
- `ffmpeg`
- `ffprobe`
- `yt-dlp`

## Getting Started

1. Install the `npm` package globally:
   ```sh
   npm i -g spoti
   ```
2. Run the `spoti` CLI from anywhere:
   ```sh
   spoti --help
   ```

## Usage

The `spoti` CLI supports the following commands:

### `download`

Download tracks from a Spotify URL. Currently, supports `/track/{id}` and `/playlist/{id}` endpoints.

```sh
spoti download [options] <url>
```

| Argument | Description                                       |
| -------- | ------------------------------------------------- |
| `<url>`  | A spotify URL to download tracks from (required). |

| Option          | Description                                 |
| --------------- | ------------------------------------------- |
| `--force`       | Force download and overwrite existing files |
| `--format`/`-f` | The output audio file format (default: mp3) |
| `--no-cache`    | Disables using cached search results        |
| `--no-prefixes` | Disallow prefixes in file names             |
| `--no-suffixes` | Disallow suffixes in file names             |
| `--help`/`-h`   | Display help for command                    |

### `info`

Retrieve information about a Spotify URL. Currently, supports `/track/{id}` and `/playlist/{id}` endpoints.

```sh
spoti info <url>
```

| Argument | Description                                       |
| -------- | ------------------------------------------------- |
| `<url>`  | A spotify URL to download tracks from (required). |

### `library`

Retrieve information about your music library.

```sh
spoti library [options] [file]
```

| Argument | Description                                      |
| -------- | ------------------------------------------------ |
| `[file]` | An audio file or Spoti metadata file (optional). |

| Option       | Description                                          |
| ------------ | ---------------------------------------------------- |
| `--more`     | Output ID3 tags and calculate real duration (slower) |
| `--no-cache` | Disables using cached search results                 |

### `sanitize`

Sanitizes files in your music library.

```sh
spoti sanitize [options] [file]
```

| Argument | Description                                      |
| -------- | ------------------------------------------------ |
| `[file]` | An audio file or Spoti metadata file (optional). |

| Option       | Description                                      |
| ------------ | ------------------------------------------------ |
| `--clean`    | Clean temporary files instead of sanitizing them |
| `--dry`      | Perform a dry run without making changes         |
| `--no-cache` | Disables using cached search results             |

### `search`

Searches tracks in a given Spotify URL on YouTube. Currently supports `/track/{id}` and `/playlist/{id}` endpoints.

```sh
spoti search [options] <url>
```

| Argument | Description                                                     |
| -------- | --------------------------------------------------------------- |
| `<url>`  | An Spotify URL with tracks to search for on YouTube (required). |

| Option       | Description                          |
| ------------ | ------------------------------------ |
| `--no-cache` | Disables using cached search results |

### `sync`

Sync tracks from a Spotify URL to your music library. Currently supports `/track/{id}` and `/playlist/{id}` endpoints.

```sh
spoti sync [options] <query> [file]
```

| Argument  | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `<query>` | A Spoti metadata file or a Spotify URL (required).                |
| `[file]`  | A Spoti metadata file when `<query>` is a Spotify URL (optional). |

| Option          | Description                                 |
| --------------- | ------------------------------------------- |
| `--force`       | Force download and overwrite existing files |
| `--format`/`-f` | The output audio file format (default: mp3) |
| `--init`        | Initialize the Spoti metadata file only     |
| `--no-cache`    | Disables using cached search results        |
| `--no-prefixes` | Disallow prefixes in file names             |
| `--no-suffixes` | Disallow suffixes in file names             |

### `tag`

Update the ID3 tags of your music library.

```sh
spoti tag [options] [file]
```

| Argument | Description                                     |
| -------- | ----------------------------------------------- |
| `[file]` | A audio file or Spoti metadata file (optional). |

| Option       | Description                              |
| ------------ | ---------------------------------------- |
| `--dry`      | Perform a dry run without making changes |
| `--no-cache` | Disables using cached search results     |

## Contributing

1. Clone the repository:
   ```sh
   git clone https://github.com/laurenhamel/spoti
   ```
2. Install dependencies:
   ```sh
   nvm use && yarn install
   ```
3. Create a global `npm` link:
   ```sh
   npm link
   ```
4. Happy hacking!
