#!/usr/bin/env node --no-warnings
import "tsx/esm";
import { tsImport } from "tsx/esm/api";

const { loadEnvs } = await tsImport(
  "../src/utils/environment",
  import.meta.url
);

loadEnvs();

await import("../src/index");
