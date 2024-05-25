#!/usr/bin/node
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = process.argv.slice(process.argv.indexOf(process.cwd()) + 1);

spawnSync(
  "yarn",
  [
    "node",
    "--loader",
    "tsx",
    resolve(__dirname, "../src/index.ts"),
    "--",
    ...argv,
  ],
  {
    shell: true,
    stdio: "inherit",
    env: { ...process.env },
  }
);
