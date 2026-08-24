import dotenv from "dotenv";
import { uniq } from "lodash-es";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadEnv(): void {
  const path = uniq([
    resolve(__dirname, "../../.env"),
    resolve(process.cwd(), ".env"),
  ]);

  dotenv.config({ path, quiet: true });
}
