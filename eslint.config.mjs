import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"];
const frontendFiles = [
  "artifacts/hostack/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
  "artifacts/mockup-sandbox/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
  "lib/auth-web/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
  "lib/api-client-react/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.replit-artifact/**",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: frontendFiles,
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "19.1",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["artifacts/api-server/**/*.{ts,mts,cts,tsx}"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
    },
  },
  eslintConfigPrettier,
);
