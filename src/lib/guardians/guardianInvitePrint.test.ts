import { describe, expect, test } from "vite-plus/test";

import {
  buildGuardianInviteSheetHtml,
  chunkGuardianInviteSlips,
  formatGuardianInviteExpiry,
  GUARDIAN_INVITE_SLIPS_PER_PAGE,
  type GuardianInvitePrintLabels,
  type GuardianInviteSlip,
} from "./guardianInvitePrint";

function slip(index: number): GuardianInviteSlip {
  return {
    studentName: `Student ${index}`,
    code: "ABC123",
    shareUrl: `http://localhost/join?jc=ABC123`,
    expiresAt: Date.UTC(2026, 8, 10, 12, 0, 0),
  };
}

const labels: GuardianInvitePrintLabels = {
  documentTitle: "Guardian invites",
  studentLabel: "Student",
  codeLabel: "Invite code",
  expiresLabel: (date) => `Expires ${date}`,
  step1: "Scan the QR.",
  step2: "Sign in.",
  step3: "Tap Join.",
  logoAlt: "Logo",
  lang: "en",
};

describe("chunkGuardianInviteSlips", () => {
  test("pages slips into nines", () => {
    const pages = chunkGuardianInviteSlips(Array.from({ length: 10 }, (_, index) => slip(index)));
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(GUARDIAN_INVITE_SLIPS_PER_PAGE);
    expect(pages[1]).toHaveLength(1);
  });
});

describe("buildGuardianInviteSheetHtml", () => {
  test("scopes the print body class and paginates", () => {
    const html = buildGuardianInviteSheetHtml(
      Array.from({ length: 10 }, (_, index) => slip(index)),
      labels,
      "http://localhost/brand/logo/icon-above-text.webp",
    );
    expect(html).toContain('class="print-guardian-invites"');
    expect(html).toContain('lang="en-US"');
    expect(html).toContain('class="page"');
    expect(html).toContain('class="page page-last"');
    expect(html).toContain("Student 1");
    expect(html).toContain("ABC–123");
    expect(html).toContain("<svg");
  });

  test("escapes student names", () => {
    const html = buildGuardianInviteSheetHtml(
      [
        {
          studentName: `A & B <script>"x"</script>`,
          code: "ABCDEF",
          shareUrl: "http://localhost/join?jc=ABCDEF",
          expiresAt: Date.UTC(2026, 8, 10, 12, 0, 0),
        },
      ],
      labels,
      "http://localhost/logo.webp",
    );
    expect(html).toContain("A &amp; B &lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  test("formats expiry for the sheet language", () => {
    const formatted = formatGuardianInviteExpiry(Date.UTC(2026, 8, 10, 12, 0, 0), "en");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
