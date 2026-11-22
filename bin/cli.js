#!/usr/bin/env node --no-warnings
import "tsx/esm";
import { tsImport } from "tsx/esm/api";

const { loadEnvs, ensureEnvVar } = await tsImport(
  "../src/utils/environment",
  import.meta.url
);

loadEnvs();

ensureEnvVar("PWD", process.cwd());

await import("../src/index");
