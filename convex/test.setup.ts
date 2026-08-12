/// <reference types="vite/client" />

import authzTest from "@djpanda/convex-authz/test";
import { convexTest } from "convex-test";

import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

export function createConvexTest() {
  const test = convexTest(schema, modules);
  authzTest.register(test, "authz");
  return test;
}
