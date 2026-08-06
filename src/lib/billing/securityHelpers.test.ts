import { describe, expect, test } from "vite-plus/test";

import { normalizeEmail } from "../../../convex/lib/trial";
import { scrubDetail } from "../../../convex/lib/polarErrors";

describe("normalizeEmail", () => {
  test("lowercases and strips gmail aliases", () => {
    expect(normalizeEmail("Foo.Bar+tag@gmail.com")).toBe("foobar@gmail.com");
    expect(normalizeEmail("foo.bar@googlemail.com")).toBe("foobar@gmail.com");
  });

  test("applies NFKC and strips leftover non-ascii", () => {
    expect(normalizeEmail("ＡＢＣ@Example.COM")).toBe("abc@example.com");
  });
});

describe("scrubDetail", () => {
  test("redacts email-like substrings", () => {
    expect(scrubDetail("Customer user@example.com failed")).toBe(
      "Customer [redacted-email] failed",
    );
  });
});
