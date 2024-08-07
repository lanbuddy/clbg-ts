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
      "max-lines": ["error", { max: 500 }],
      "max-lines-per-function": ["error", { max: 100 }],
      "max-statements": ["error", { max: 20 }],
      "no-magic-numbers": ["error", { ignore: [0, 1] }],
      "no-unused-vars": "off",
      "one-var": ["error", { const: "never", let: "never", var: "always" }],
    },
  },
];
