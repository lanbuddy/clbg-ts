import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.all,
  ...tseslint.configs.stylistic,
  {
    rules: {
      "one-var": ["error", { const: "never", let: "never", var: "always" }],
    },
  },
];
