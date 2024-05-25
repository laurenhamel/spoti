#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = process.argv.slice(2);

spawnSync(
  "yarn",
  ["node", "--loader", "tsx", resolve(__dirname, "../src/index.ts"), ...argv],
  {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
  }
);
