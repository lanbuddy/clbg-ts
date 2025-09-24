/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  moduleNameMapper: {
    "^(\\.\\.?\\/.*)\\.js$": "$1",
  },
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": [
      "ts-jest",
      {
        diagnostics: { ignoreCodes: ["TS151001"] },
        tsconfig: "tsconfig.esm.json",
      },
    ],
  },
};
