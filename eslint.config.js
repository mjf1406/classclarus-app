import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import pluginQuery from "@tanstack/eslint-plugin-query";
import convexPlugin from "@convex-dev/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default [
  {
    ignores: [
      "node_modules",
      "dist",
      "dist-electron/**",
      "release/**",
      "resources/**",
      "public/**",
      "docker/**",
      "convex/_generated/**",
      "src/routeTree.gen.ts",
      "convex/**/*.test.ts",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          // allow running with TS default project options for files that
          // aren't part of any tsconfig (e.g. `eslint.config.js`)
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir,
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Type-aware TS rules (avoid false positives from base rules)
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Replace oxlint "react" correctness subset
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],

      // Replace Vite+ oxlint rule "prefer-vite-plus-imports"
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["vitest"], message: "Use `vite-plus/test`." },
            {
              group: ["vitest/*"],
              message: "Use `vite-plus/test/*`.",
            },
            { group: ["vitest/config"], message: "Use `vite-plus`." },

            { group: ["@vitest/browser"], message: "Use `vite-plus/test/browser`." },
            {
              group: ["@vitest/browser/*"],
              message: "Use `vite-plus/test/browser/*`.",
            },
            {
              group: ["@vitest/browser-playwright"],
              message: "Use `vite-plus/test/browser-playwright`.",
            },
            {
              group: ["@vitest/browser-playwright/*"],
              message: "Use `vite-plus/test/browser-playwright/*`.",
            },
            {
              group: ["@vitest/browser-preview"],
              message: "Use `vite-plus/test/browser-preview`.",
            },
            {
              group: ["@vitest/browser-preview/*"],
              message: "Use `vite-plus/test/browser-preview/*`.",
            },
          ],
        },
      ],
    },
  },

  // TanStack Query rules (AST-only; safe without type info).
  ...pluginQuery.configs["flat/recommended"],

  // Convex rules (some require type-aware linting).
  ...convexPlugin.configs.recommended,

  // Additional Convex hardening for this template.
  {
    files: ["convex/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          // Use the dedicated tsconfig for Convex so type-aware rules
          // (e.g. `@convex-dev/*`) have type info.
          defaultProject: "./tsconfig.convex.json",
          // Disallowing `**` keeps lint fast; we only need this for
          // the current Convex directory depth.
          allowDefaultProject: [
            "convex/*.ts",
            "convex/*/*.ts",
            "convex/*/*/*.ts",
            "eslint.config.js",
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 80,
        },
        tsconfigRootDir,
      },
    },
    rules: {
      "@convex-dev/no-collect-in-query": "error",
    },
  },

  // Electron main/preload + shared types (Node, tsconfig.node.json).
  // Do not list these paths in allowDefaultProject — they are already in
  // tsconfig.node.json; dual membership makes typed lint fail to parse.
  {
    files: ["electron/*.ts", "shared/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          defaultProject: "./tsconfig.node.json",
        },
        tsconfigRootDir,
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Preload/main are not React Fast Refresh modules.
      "react-refresh/only-export-components": "off",
    },
  },

  // Bun/Node scripts + root builder configs (no TS project).
  {
    files: ["scripts/**/*.{js,mjs,cjs}", "electron-builder.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
];
