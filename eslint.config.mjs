import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import noElseIf from "eslint-plugin-no-else-if";
import nextConfig from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  js.configs.recommended,
  ...nextConfig,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      "no-else-if": noElseIf,
    },
    languageOptions: {
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
    },
    rules: {
      "no-else-if/no-else-if": "error",
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
      complexity: ["error", { max: 10 }],
      "no-unused-expressions": "off",
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      curly: ["error", "all"],
      "no-debugger": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-empty-function": [
        "error",
        {
          allow: [],
        },
      ],
      "no-var": "error",
      "no-alert": "off",
      "no-case-declarations": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "dist/**",
    "next-env.d.ts",
    "*.config.js",
  ]),
]);
