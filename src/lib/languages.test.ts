import { describe, expect, test } from "vite-plus/test";

import { toIntlLocale } from "./languages";

describe("toIntlLocale", () => {
  test("maps app language codes to BCP 47 tags", () => {
    expect(toIntlLocale("engb")).toBe("en-GB");
    expect(toIntlLocale("en")).toBe("en-US");
    expect(toIntlLocale("zhs")).toBe("zh-Hans");
    expect(toIntlLocale("zht")).toBe("zh-Hant");
    expect(toIntlLocale("ja")).toBe("ja");
  });

  test("passes through unknown language tags", () => {
    expect(toIntlLocale("en-AU")).toBe("en-AU");
  });
});
