#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = process.argv.slice(2);

const CWD = resolve(__dirname, "../");
const PWD = process.env.PWD;

spawnSync(
  "yarn",
  [
    "--cwd",
    CWD,
    "node",
    "--loader",
    "tsx",
    resolve(__dirname, "../src/index.ts"),
    ...argv,
    "--pwd",
    PWD,
  ],
  {
    shell: true,
    stdio: "inherit",
  }
);
