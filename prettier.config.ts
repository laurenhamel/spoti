import { type Config } from "prettier";

export default {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  trailingComma: "es5",
  overrides: [
    {
      files: "*.jsonc",
      options: {
        trailingComma: "none",
      },
    },
  ],
} satisfies Config;
