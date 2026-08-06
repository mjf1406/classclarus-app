#!/usr/bin/env bun
import path from "node:path";
import { runSelfHostBootstrap } from "./self-host-bootstrap.mjs";

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      out[key] = value;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const required = ["convex-url", "admin-key-file", "data-dir", "site-url", "project-dir"];
for (const key of required) {
  if (!args[key]) {
    console.error(`Missing --${key}`);
    process.exit(1);
  }
}

await runSelfHostBootstrap({
  convexUrl: args["convex-url"],
  adminKeyFile: args["admin-key-file"],
  dataDir: args["data-dir"],
  siteUrl: args["site-url"],
  projectDir: path.resolve(args["project-dir"]),
  appVersion: args["app-version"],
});
