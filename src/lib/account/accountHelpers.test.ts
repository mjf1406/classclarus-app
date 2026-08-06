import { describe, expect, test } from "vite-plus/test";

import { accountDeleteConfirmationPhrase, providerDisplayName } from "@/lib/account/accountHelpers";
import { deriveEntitlement } from "@/lib/billing/entitlement";
import { buildPlanSummary } from "@/lib/billing/planSummary";

describe("accountDeleteConfirmationPhrase", () => {
  test("uses email when present", () => {
    expect(accountDeleteConfirmationPhrase("  user@example.com ")).toBe("delete user@example.com");
  });

  test("falls back without email", () => {
    expect(accountDeleteConfirmationPhrase(null)).toBe("delete my account");
    expect(accountDeleteConfirmationPhrase(undefined)).toBe("delete my account");
    expect(accountDeleteConfirmationPhrase("   ")).toBe("delete my account");
  });
});

describe("providerDisplayName", () => {
  test("formats known and unknown providers", () => {
    expect(providerDisplayName("google")).toBe("Google");
    expect(providerDisplayName("password")).toBe("Password");
    expect(providerDisplayName("github")).toBe("Github");
  });
});

describe("buildPlanSummary", () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === "summaryRenews") {
      return `${options?.plan} · renews ${options?.date}`;
    }
    if (key === "summaryCancels") {
      return `${options?.plan} · cancels ${options?.date}`;
    }
    if (key === "trialActive") {
      return `Free trial — ${options?.count} day left`;
    }
    const labels: Record<string, string> = {
      freeTitle: "Free",
      proLabel: "Pro",
      trialLabel: "Trial",
      monthlyTitle: "Monthly",
      yearlyTitle: "Yearly",
      dateUnknown: "—",
      trialExpiredTitle: "Your free trial has ended",
    };
    return labels[key] ?? key;
  };

  test("returns free when entitlement is missing", () => {
    expect(
      buildPlanSummary({
        entitlement: null,
        subscription: null,
        locale: "en",
        t,
      }),
    ).toEqual({ compactLabel: "Free", line: "Free" });
  });

  test("formats active renewal and cancellation", () => {
    const entitlement = deriveEntitlement({
      trialEndsAt: null,
      subscriptionStatus: "active",
    });

    expect(
      buildPlanSummary({
        entitlement,
        subscription: {
          productKey: "proMonthly",
          productName: null,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: "2027-03-01T00:00:00.000Z",
          endsAt: null,
        },
        locale: "en-US",
        t,
      }).compactLabel,
    ).toBe("Pro");

    expect(
      buildPlanSummary({
        entitlement,
        subscription: {
          productKey: "proYearly",
          productName: null,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: "2027-03-01T00:00:00.000Z",
          endsAt: "2027-03-01T00:00:00.000Z",
        },
        locale: "en-US",
        t,
      }).line,
    ).toContain("cancels");
  });

  test("formats trial and expired states", () => {
    const now = Date.UTC(2026, 6, 30);
    const trialing = deriveEntitlement(
      {
        trialEndsAt: now + 2 * 24 * 60 * 60 * 1000,
        subscriptionStatus: null,
      },
      now,
    );
    expect(
      buildPlanSummary({
        entitlement: trialing,
        subscription: null,
        locale: "en",
        t,
      }),
    ).toEqual({
      compactLabel: "Trial",
      line: "Free trial — 2 day left",
    });

    const expired = deriveEntitlement(
      {
        trialEndsAt: now - 1,
        subscriptionStatus: null,
      },
      now,
    );
    expect(
      buildPlanSummary({
        entitlement: expired,
        subscription: null,
        locale: "en",
        t,
      }),
    ).toEqual({
      compactLabel: "Free",
      line: "Your free trial has ended",
    });
  });
});
