import { describe, expect, test } from "vite-plus/test";

import {
  buildPrintDocumentClose,
  buildPrintDocumentOpen,
  escapePrintHtml,
  printStylesheetUrl,
} from "@/lib/print/printDocument";

describe("escapePrintHtml", () => {
  test("escapes HTML special characters", () => {
    expect(escapePrintHtml(`A & B <script>"x"</script>`)).toBe(
      "A &amp; B &lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });
});

describe("buildPrintDocumentOpen", () => {
  test("links external print stylesheet and scopes body class", () => {
    const open = buildPrintDocumentOpen({
      title: "Seats",
      bodyClass: "print-seats",
    });
    expect(open).toContain('<link rel="stylesheet"');
    expect(open).toContain(printStylesheetUrl());
    expect(open).toContain('class="print-seats"');
    expect(open).not.toContain("<style>");
  });

  test("includes lang when provided", () => {
    const open = buildPrintDocumentOpen({
      title: "Jobs",
      bodyClass: "print-table-assigner",
      lang: "en",
    });
    expect(open).toContain('<html lang="en">');
  });
});

describe("buildPrintDocumentClose", () => {
  test("closes body and html", () => {
    expect(buildPrintDocumentClose()).toContain("</body>");
    expect(buildPrintDocumentClose()).toContain("</html>");
  });
});
