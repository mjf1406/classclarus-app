import { describe, expect, test } from "vite-plus/test";

import { assertSafePolarCheckoutUrl } from "./polarUrl";

describe("assertSafePolarCheckoutUrl", () => {
  test("accepts polar.sh and subdomains", () => {
    expect(assertSafePolarCheckoutUrl("https://polar.sh/checkout/abc")).toBe(
      "https://polar.sh/checkout/abc",
    );
    expect(assertSafePolarCheckoutUrl("https://sandbox.polar.sh/checkout/x")).toBe(
      "https://sandbox.polar.sh/checkout/x",
    );
    expect(assertSafePolarCheckoutUrl("https://api.polar.sh/v1/x")).toBe(
      "https://api.polar.sh/v1/x",
    );
  });

  test("rejects non-https and non-Polar hosts", () => {
    expect(() => assertSafePolarCheckoutUrl("http://polar.sh/x")).toThrow("Invalid Polar URL");
    expect(() => assertSafePolarCheckoutUrl("https://evil.com/x")).toThrow("Invalid Polar URL");
    expect(() => assertSafePolarCheckoutUrl("https://polar.sh.evil.com/x")).toThrow(
      "Invalid Polar URL",
    );
    expect(() => assertSafePolarCheckoutUrl("not-a-url")).toThrow("Invalid Polar URL");
  });
});
