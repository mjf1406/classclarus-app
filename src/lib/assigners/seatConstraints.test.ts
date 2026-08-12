import { describe, expect, it } from "vite-plus/test";

import {
  formatSeatConstraintPlainLanguage,
  seatConstraintPlainLanguageParts,
  type SeatConstraint,
} from "@/lib/assigners/seatConstraints";
import type { Id } from "../../../convex/_generated/dataModel";

const studentUserId = "student1" as Id<"users">;
const otherUserId = "other1" as Id<"users">;

function mockT(key: string, options?: Record<string, string>): string {
  if (key === "constraintPlain_neighbor_must") {
    return `${options?.student} must be neighbors with ${options?.other}.`;
  }
  if (key === "constraintPlain_neighbor_mustNot") {
    return `${options?.student} must not be neighbors with ${options?.other}.`;
  }
  if (key === "constraintPlain_teammate_must") {
    return `${options?.student} must be a teammate with ${options?.other}.`;
  }
  if (key === "constraintPlain_teammate_mustNot") {
    return `${options?.student} must not be a teammate with ${options?.other}.`;
  }
  if (key === "constraintPlain_zone_must") {
    return `${options?.student} must sit in the ${options?.zone} zone.`;
  }
  if (key === "constraintPlain_zone_mustNot") {
    return `${options?.student} must not sit in the ${options?.zone} zone.`;
  }
  if (key === "constraintUnknownStudent") {
    return "Unknown student";
  }
  return key;
}

const studentName = (userId: Id<"users">) => {
  if (userId === studentUserId) return "Tristi Greare";
  if (userId === otherUserId) return "Mark Tristan";
  return "Unknown student";
};

function constraint(
  fields: Omit<SeatConstraint, "_id" | "_creationTime" | "classId" | "createdBy" | "updatedAt"> &
    Partial<Pick<SeatConstraint, "_id" | "classId" | "createdBy" | "updatedAt">>,
): SeatConstraint {
  return {
    _id: "c1" as Id<"seatConstraints">,
    _creationTime: 0,
    classId: "class1" as Id<"classes">,
    createdBy: "teacher1" as Id<"users">,
    updatedAt: 1,
    ...fields,
  };
}

describe("formatSeatConstraintPlainLanguage", () => {
  it("formats neighbor must constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "neighbor",
          polarity: "must",
          studentUserId,
          otherStudentUserId: otherUserId,
        }),
        studentName,
        mockT,
      ),
    ).toBe("Tristi Greare must be neighbors with Mark Tristan.");
  });

  it("formats neighbor mustNot constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "neighbor",
          polarity: "mustNot",
          studentUserId,
          otherStudentUserId: otherUserId,
        }),
        studentName,
        mockT,
      ),
    ).toBe("Tristi Greare must not be neighbors with Mark Tristan.");
  });

  it("formats teammate must constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "teammate",
          polarity: "must",
          studentUserId: otherUserId,
          otherStudentUserId: studentUserId,
        }),
        studentName,
        mockT,
      ),
    ).toBe("Mark Tristan must be a teammate with Tristi Greare.");
  });

  it("formats teammate mustNot constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "teammate",
          polarity: "mustNot",
          studentUserId,
          otherStudentUserId: otherUserId,
        }),
        studentName,
        mockT,
      ),
    ).toBe("Tristi Greare must not be a teammate with Mark Tristan.");
  });

  it("formats zone must constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "zone",
          polarity: "must",
          studentUserId,
          zoneName: "Front",
        }),
        studentName,
        mockT,
      ),
    ).toBe("Tristi Greare must sit in the Front zone.");
  });

  it("formats zone mustNot constraints", () => {
    expect(
      formatSeatConstraintPlainLanguage(
        constraint({
          type: "zone",
          polarity: "mustNot",
          studentUserId,
          zoneName: "Back",
        }),
        studentName,
        mockT,
      ),
    ).toBe("Tristi Greare must not sit in the Back zone.");
  });

  it("returns interpolation parts for Trans", () => {
    expect(
      seatConstraintPlainLanguageParts(
        constraint({
          type: "zone",
          polarity: "must",
          studentUserId,
          zoneName: "Front",
        }),
        studentName,
        mockT,
      ),
    ).toEqual({
      key: "constraintPlain_zone_must",
      values: { student: "Tristi Greare", zone: "Front" },
    });
  });
});
