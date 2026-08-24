#!/usr/bin/env node --no-warnings
import "tsx/esm";
import { tsImport } from "tsx/esm/api";

const { loadEnv } = await tsImport("../src/utils/environment", import.meta.url);

loadEnv();

await import("../src/index");
