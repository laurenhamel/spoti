import { resolveBin } from "./path";
import { runSync } from "./process";
import { globSync } from "glob";
import { template } from "lodash-es";
import { platform, homedir } from "node:os";
import semver from "semver";

const PLAYWRIGHT_VERSION = "1.47.0";
const PLAYWRIGHT_BINARY = "playwright";

const CHROMIUM_CACHE: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "<%= home %>/Library/Caches/ms-playwright",
  win32: "<%= home %>/AppData/Local/ms-playwright",
  linux: "<%= home %>/.cache/ms-playwright",
};

/**
 * Verifies that macOS 13 is using `playwright@1.47.0` or older.
 */
export function checkPlaywrightVersion(): void {
  if (platform() !== "darwin") return;

  const os = Number(runSync("sw_vers -productVersion").split(".")[0]);

  if (os > 13) return;

  const playwright = resolveBin(PLAYWRIGHT_BINARY, true);
  const version = runSync(`${playwright} --version`).split(" ")[1];

  if (semver.gt(version, PLAYWRIGHT_VERSION)) {
    throw new Error(
      [
        `An unsupported version of 'playwright' is being used.`,
        `Use version ≤${PLAYWRIGHT_VERSION} for macOS 13 support.`,
      ].join("\n")
    );
  }
}

/**
 * Verifies that some Chromium browser version is installed.
 */
export function ensureChromiumInstalled(): void {
  const home = homedir();
  const cache = template(CHROMIUM_CACHE[platform()])({ home });
  const versions = globSync("chromium-*", { cwd: cache });

  if (!versions.length) {
    const playwright = resolveBin(PLAYWRIGHT_BINARY, true);

    // Attempt to install Chromium
    runSync(`${playwright} install --with-deps chromium`, {
      stdio: "inherit",
    });
  }
}
