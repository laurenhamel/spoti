#!/usr/bin/env node --no-warnings
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = process.argv.slice(2);

const CWD = resolve(__dirname, "../");
const PWD = process.env.PWD;

const pwd = '"' + PWD.replace(/"/g, '\\"') + '"';

spawnSync(
  "yarn",
  [
    "tsx",
    resolve(__dirname, "../src/index.ts"),
    ...argv,
    "--cwd",
    CWD,
    "--pwd",
    pwd,
  ],
  {
    stdio: "inherit",
    env: process.env,
  }
);
