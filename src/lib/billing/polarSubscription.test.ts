import { describe, expect, test } from "vite-plus/test";

import { toPolarComponentSubscription } from "../../../convex/lib/polarSubscription";

describe("toPolarComponentSubscription", () => {
  test("converts Date fields to ISO strings", () => {
    const createdAt = new Date("2024-01-15T12:00:00.000Z");
    const result = toPolarComponentSubscription({
      id: "sub_1",
      customerId: "cus_1",
      createdAt,
      modifiedAt: new Date("2024-01-16T12:00:00.000Z"),
      productId: "prod_1",
      checkoutId: "chk_1",
      amount: 1000,
      currency: "usd",
      recurringInterval: "month",
      status: "active",
      currentPeriodStart: new Date("2024-01-15T12:00:00.000Z"),
      currentPeriodEnd: new Date("2024-02-15T12:00:00.000Z"),
      cancelAtPeriodEnd: false,
      customerCancellationReason: null,
      customerCancellationComment: null,
      startedAt: new Date("2024-01-15T12:00:00.000Z"),
      endedAt: null,
      metadata: { userId: "u1" },
      discountId: null,
      canceledAt: null,
      endsAt: null,
      recurringIntervalCount: 1,
      trialStart: null,
      trialEnd: null,
      seats: null,
      customFieldData: undefined,
    } as unknown as Parameters<typeof toPolarComponentSubscription>[0]);

    expect(result.id).toBe("sub_1");
    expect(result.status).toBe("active");
    expect(result.createdAt).toBe("2024-01-15T12:00:00.000Z");
    expect(result.modifiedAt).toBe("2024-01-16T12:00:00.000Z");
    expect(result.endedAt).toBeNull();
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  test("accepts already-string timestamps", () => {
    const result = toPolarComponentSubscription({
      id: "sub_2",
      customerId: "cus_2",
      createdAt: "2024-03-01T00:00:00.000Z",
      modifiedAt: null,
      productId: "prod_2",
      checkoutId: null,
      amount: null,
      currency: null,
      recurringInterval: null,
      status: "canceled",
      currentPeriodStart: "2024-03-01T00:00:00.000Z",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: true,
      customerCancellationReason: "too_expensive",
      customerCancellationComment: null,
      startedAt: null,
      endedAt: "2024-04-01T00:00:00.000Z",
      metadata: {},
      discountId: null,
      canceledAt: "2024-03-20T00:00:00.000Z",
      endsAt: "2024-04-01T00:00:00.000Z",
      recurringIntervalCount: undefined,
      trialStart: null,
      trialEnd: null,
      seats: 3,
      customFieldData: { note: "x" },
    } as unknown as Parameters<typeof toPolarComponentSubscription>[0]);

    expect(result.status).toBe("canceled");
    expect(result.createdAt).toBe("2024-03-01T00:00:00.000Z");
    expect(result.endedAt).toBe("2024-04-01T00:00:00.000Z");
    expect(result.seats).toBe(3);
  });
});
