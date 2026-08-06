import { defineConfig, lazyPlugins } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import type { Plugin, PluginOption } from "vite";

import { APP_CONFIG } from "./convex/appConfig.js";

/** Keep FOUC theme bootstrap in index.html aligned with STORAGE_KEYS.theme. */
function injectAppThemeStorageKey(): Plugin {
  const themeStorageKey = `${APP_CONFIG.slug}-ui-theme`;
  return {
    name: "inject-app-theme-storage-key",
    transformIndexHtml(html) {
      return html.replaceAll("%APP_THEME_STORAGE_KEY%", themeStorageKey);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  run: {
    tasks: {
      "dev:web": {
        command: "vp dev",
        cache: false,
      },
      "dev:convex": {
        command: "bunx convex dev",
        cache: false,
      },
      ds: {
        command: "echo Both stopped.",
        dependsOn: ["dev:web", "dev:convex"],
        cache: false,
      },
    },
  },
  staged: {
    // vp staged does not use a shell, so `cmd1 && cmd2` passes later tokens
    // (including eslint's `--fix`) into the first command. Keep tasks separate.
    // Also avoid `vp check --fix`: it forwards `--fix` to Oxfmt, which wants `--write`.
    "*": "vp fmt --write",
    "*.{ts,tsx,js,jsx}": "bunx eslint --fix",
  },
  fmt: {},
  check: {
    lint: false,
  },
  plugins: lazyPlugins(() => {
    const plugins: PluginOption[] = [
      injectAppThemeStorageKey(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ];
    // React Compiler + Babel is memory-heavy; Docker/Portainer builds often OOM (exit 134).
    if (process.env.DISABLE_REACT_COMPILER !== "true") {
      plugins.push(babel({ presets: [reactCompilerPreset()] }));
    }
    plugins.push(
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: [
          "vctr/vctr-favicon.webp",
          "brand/logo/icon-86.webp",
          "pwa/apple-touch-icon.png",
        ],
        manifest: {
          name: APP_CONFIG.name,
          short_name: APP_CONFIG.name,
          description: `${APP_CONFIG.name} ${APP_CONFIG.titleSuffix}`,
          theme_color: APP_CONFIG.themeColors.light,
          background_color: APP_CONFIG.backgroundColors.light,
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/pwa/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          globIgnores: ["**/_headers", "**/_redirects"],
        },
        devOptions: { enabled: false },
      }),
    );
    return plugins;
  }),
  build: {
    // Slightly lower peak RAM during Docker image builds.
    reportCompressedSize: false,
    sourcemap: false,
  },
});
