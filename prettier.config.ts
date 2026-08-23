import { type Config } from "prettier";

export default {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  trailingComma: "es5",
} satisfies Config;
