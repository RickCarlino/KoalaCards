const rulesDirPlugin = require("eslint-plugin-rulesdir");
rulesDirPlugin.RULES_DIR = "eslint-rules";

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "next",
  ],
  plugins: ["@typescript-eslint", "rulesdir"],
  ignorePatterns: ["node_modules/**", "dist/**", "*.config.js"],
  rules: {
    "rulesdir/no-else-if": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-console": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-unused-expressions": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/no-unescaped-entities": "off",
    complexity: ["warn", { max: 20 }],
    "no-unused-expressions": "off",
    eqeqeq: ["error", "always"],
    "prefer-const": "error",
    curly: ["error", "all"],
    "no-debugger": "error",
    "no-alert": "error",
    "no-empty": "error",
    "no-var": "error",
    "no-alert": "off",
  },

  globals: {
    Bun: "readonly",

    Buffer: "readonly",
    process: "readonly",
    console: "readonly",
    require: "readonly",
    module: "readonly",
    __dirname: "readonly",
    __filename: "readonly",

    URL: "readonly",
    URLSearchParams: "readonly",
    Request: "readonly",
    Response: "readonly",
    fetch: "readonly",
    TextEncoder: "readonly",
    TextDecoder: "readonly",
    AbortSignal: "readonly",

    setTimeout: "readonly",
    setInterval: "readonly",
    clearTimeout: "readonly",
    clearInterval: "readonly",
  },
};
