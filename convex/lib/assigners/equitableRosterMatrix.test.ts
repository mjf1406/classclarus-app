import { describe, expect, it } from "vite-plus/test";

import {
  buildEquitablePartnerSummaries,
  buildEquitableRosterMatrixCounts,
} from "../../../convex/lib/assigners/equitableRosterMatrix";

describe("buildEquitableRosterMatrixCounts", () => {
  it("counts assignments per current item for each student", () => {
    const result = buildEquitableRosterMatrixCounts(
      ["Line leader", "Cleanup"],
      ["u1" as never, "u2" as never],
      [
        { studentUserId: "u1", item: "Line leader" },
        { studentUserId: "u1", item: "Line leader" },
        { studentUserId: "u1", item: "Cleanup" },
        { studentUserId: "u2", item: "Cleanup" },
        { studentUserId: "u2", item: "Retired item" },
      ],
    );

    expect(result).toEqual([
      {
        studentUserId: "u1",
        counts: [
          { item: "Line leader", count: 2 },
          { item: "Cleanup", count: 1 },
        ],
      },
      {
        studentUserId: "u2",
        counts: [
          { item: "Line leader", count: 0 },
          { item: "Cleanup", count: 1 },
        ],
      },
    ]);
  });

  it("returns zero counts when there is no history", () => {
    const result = buildEquitableRosterMatrixCounts(["A"], ["u1" as never], []);

    expect(result).toEqual([
      {
        studentUserId: "u1",
        counts: [{ item: "A", count: 0 }],
      },
    ]);
  });
});

describe("buildEquitablePartnerSummaries", () => {
  it("counts same-item same-group pairs and keeps the latest snapshot name", () => {
    const result = buildEquitablePartnerSummaries(
      ["u1" as never, "u2" as never],
      [
        {
          assignments: [
            {
              studentUserId: "u1",
              item: "Board",
              groupId: "g1",
              firstName: "Ada",
              studentDisplayName: "Ada",
            },
            {
              studentUserId: "u2",
              item: "Board",
              groupId: "g1",
              firstName: "Bo",
              studentDisplayName: "Bo",
            },
          ],
        },
        {
          assignments: [
            {
              studentUserId: "u1",
              item: "Door",
              groupId: "g1",
              firstName: "Ada",
              studentDisplayName: "Ada",
            },
            {
              studentUserId: "u2",
              item: "Door",
              groupId: "g1",
              firstName: "Bobby",
              lastName: "Lee",
              studentDisplayName: "Bobby Lee",
            },
          ],
        },
      ],
    );

    expect(result).toEqual([
      {
        studentUserId: "u1",
        partners: [
          {
            partnerUserId: "u2",
            count: 2,
            firstName: "Bobby",
            lastName: "Lee",
            name: "Bobby Lee",
          },
        ],
      },
      {
        studentUserId: "u2",
        partners: [{ partnerUserId: "u1", count: 2, firstName: "Ada", name: "Ada" }],
      },
    ]);
  });

  it("does not pair students assigned to different items", () => {
    const result = buildEquitablePartnerSummaries(
      ["u1" as never, "u2" as never],
      [
        {
          assignments: [
            { studentUserId: "u1", item: "Board" },
            { studentUserId: "u2", item: "Door" },
          ],
        },
      ],
    );

    expect(result[0]?.partners).toEqual([]);
    expect(result[1]?.partners).toEqual([]);
  });

  it("does not pair students in different groups on the same item", () => {
    const result = buildEquitablePartnerSummaries(
      ["u1" as never, "u2" as never],
      [
        {
          assignments: [
            { studentUserId: "u1", item: "Board", groupId: "g1" },
            { studentUserId: "u2", item: "Board", groupId: "g2" },
          ],
        },
      ],
    );

    expect(result[0]?.partners).toEqual([]);
    expect(result[1]?.partners).toEqual([]);
  });
});
