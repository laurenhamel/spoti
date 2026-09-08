import { type SpotiOptions } from "../types/config";
import { resolveBin } from "./path";
import { runSync } from "./process";
import chalk from "chalk";
import { globSync } from "glob";
import { template, isEmpty, once } from "lodash-es";
import { platform, homedir } from "node:os";
import semver from "semver";

const PLAYWRIGHT_VERSION = "1.47.0";
const PLAYWRIGHT_BINARY = "playwright";

// prettier-ignore
const YTDLP_LATEST = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const YTDLP_REPO = "https://github.com/yt-dlp/yt-dlp";
const YTDLP_BINARY = "yt-dlp";

const CHROMIUM_CACHE: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "<%= home %>/Library/Caches/ms-playwright",
  win32: "<%= home %>/AppData/Local/ms-playwright",
  linux: "<%= home %>/.cache/ms-playwright",
};

/**
 * Retrieves the `playwright` binary path
 */
export function getPlaywrightBin(): string {
  const bin = resolveBin(PLAYWRIGHT_BINARY, true);

  if (!bin || isEmpty(bin)) {
    throw new Error(
      [
        `Missing required CLI: '${PLAYWRIGHT_BINARY}'.`,
        `This is a 'spoti' dependency issue.`,
      ].join("\n")
    );
  }

  return bin;
}

/**
 * Retrieves the `yt-dlp` binary path
 */
export function getYtdlpBin(): string {
  const bin = resolveBin(YTDLP_BINARY);

  if (!bin || isEmpty(bin)) {
    throw new Error(
      [
        `Missing required CLI: '${YTDLP_BINARY}'.`,
        `See ${YTDLP_REPO} for how to install.`,
      ].join("\n")
    );
  }

  return bin;
}

/**
 * Verifies that macOS 13 is using `playwright@1.47.0` or older.
 */
export const checkPlaywrightVersion = once((): void => {
  if (platform() !== "darwin") return;

  const os = Number(runSync("sw_vers -productVersion").split(".")[0]);

  if (os > 13) return;

  const playwright = getPlaywrightBin();
  const version = runSync(`${playwright} --version`).split(" ")[1];

  if (semver.gt(version, PLAYWRIGHT_VERSION)) {
    throw new Error(
      [
        `An unsupported version of '${PLAYWRIGHT_BINARY}' is being used.`,
        `Use version ≤${PLAYWRIGHT_VERSION} for macOS 13 support.`,
      ].join("\n")
    );
  }
});

/**
 * Enforces that some Chromium browser version is installed.
 */
export const ensureChromiumInstalled = once((): void => {
  const home = homedir();
  const cache = template(CHROMIUM_CACHE[platform()])({ home });
  const versions = globSync("chromium-*", { cwd: cache });

  if (!versions.length) {
    const playwright = resolveBin(PLAYWRIGHT_BINARY, true);

    // Attempt to install Chromium.
    runSync(`${playwright} install --with-deps chromium`, {
      stdio: "inherit",
    });
  }
});

/**
 * Enforces that the the `yt-dlp` binary is up-to-date.
 */
export const ensureYtdlpLatest = once(
  <TOptions extends SpotiOptions>(options?: TOptions): void => {
    const os = platform();
    const ytdlp = getYtdlpBin();
    const version = runSync(`${ytdlp} --version`).split(".");
    const json = runSync(`curl ${YTDLP_LATEST}`);
    const target = JSON.parse(json).tag_name.split(".");
    const current = new Date(`${version[0]}-${version[1]}-${version[2]}`);
    const latest = new Date(`${target[0]}-${target[1]}-${target[2]}`);

    if (current.getTime() < latest.getTime()) {
      const from = chalk.red(version.join("."));
      const to = chalk.green(target.join("."));

      if (options?.verbose) {
        console.log();
        console.log(`Updating 'yt-dlp' from ${from} → ${to}`);
      }

      const updateNative = () => runSync(`${ytdlp} -U`);
      const updatePip = () => runSync(`pip install ${YTDLP_BINARY} -U`);
      const updateBrew = () => runSync(`brew upgrade ${YTDLP_BINARY}`);
      const updateScoop = () => runSync(`scoop update ${YTDLP_BINARY}`);
      const updateChoco = () => runSync(`choco upgrade ${YTDLP_BINARY}`);
      const updateWinget = () => runSync(`winget upgrade ${YTDLP_BINARY}`);

      const updates: (() => string)[] = [
        updateNative,
        updatePip,
        ...(os === "darwin" ? [updateBrew] : []),
        ...(os === "linux" ? [updateBrew] : []),
        ...(os === "win32" ? [updateScoop, updateChoco, updateWinget] : []),
      ];

      // Force update `yt-dlp`.
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const last = i + 1 === updates.length;

        try {
          update();
          break;
        } catch (_) {
          if (!last) continue;

          throw new Error(
            [
              `Failed to auto-update: '${YTDLP_BINARY}'.`,
              `Please update manually, then try again.`,
              `See ${YTDLP_REPO} for how to update.`,
            ].join("\n")
          );
        }
      }
    }
  }
);
