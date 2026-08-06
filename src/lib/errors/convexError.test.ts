import { describe, expect, test } from "vite-plus/test";
import { ConvexError } from "convex/values";

import { codeFromError, messageFromError } from "./convexError";

describe("messageFromError", () => {
  test("reads ConvexError string data", () => {
    expect(messageFromError(new ConvexError("Nope"), "fallback")).toBe("Nope");
  });

  test("reads ConvexError object message", () => {
    expect(
      messageFromError(
        new ConvexError({ code: "ALREADY_MEMBER", message: "Already in" }),
        "fallback",
      ),
    ).toBe("Already in");
  });

  test("strips Convex Uncaught Error wrapper", () => {
    const wrapped =
      "[CONVEX M(joinCodes:redeem)] [Request ID: abc] Server Error Uncaught Error: You are already a member of this class at handler (../convex/joinCodes.ts:244:31) Called by client";
    expect(messageFromError(new Error(wrapped), "fallback")).toBe(
      "You are already a member of this class",
    );
  });

  test("falls back when message empty", () => {
    expect(messageFromError(new Error("   "), "fallback")).toBe("fallback");
  });
});

describe("codeFromError", () => {
  test("reads code from ConvexError data", () => {
    expect(codeFromError(new ConvexError({ code: "ALREADY_MEMBER", message: "x" }))).toBe(
      "ALREADY_MEMBER",
    );
  });

  test("returns undefined without code", () => {
    expect(codeFromError(new Error("nope"))).toBeUndefined();
  });
});
