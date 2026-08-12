import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel.js";
import {
  affectedStudentIdsFromEvidence,
  buildUnavailableStudentsEvidence,
  collectUnavailableStudentsFromInput,
} from "./failureEvidence.js";
import type { SeatingAlgorithmInput, SeatingConstraint } from "./types.js";

const layoutId = "layout" as Id<"seatLayouts">;
const groupId = "group" as Id<"groups">;

function constraint(index: number, values: Omit<SeatingConstraint, "id">): SeatingConstraint {
  return {
    id: `constraint-${index}` as Id<"seatConstraints">,
    ...values,
  };
}

describe("failureEvidence", () => {
  test("collects all unavailable required students", () => {
    const missingA = "missing-a" as Id<"users">;
    const missingB = "missing-b" as Id<"users">;
    const present = "present" as Id<"users">;
    const constraints = [
      constraint(0, {
        type: "neighbor",
        polarity: "must",
        studentUserId: present,
        otherStudentUserId: missingA,
      }),
      constraint(1, {
        type: "zone",
        polarity: "must",
        studentUserId: missingB,
        zoneName: "Front",
      }),
    ];
    const input: SeatingAlgorithmInput = {
      layoutId,
      slots: [],
      students: [
        {
          studentUserId: present,
          groupId,
          genderBucket: "unknown",
        },
      ],
      locked: [],
      constraints,
      history: { byStudent: new Map() },
      scope: { kind: "class" },
      genderParityMode: "off",
      genderParityAssignment: { malesOnOddDesks: true },
      randomSeed: "seed",
    };

    const evidence = collectUnavailableStudentsFromInput(input);
    expect(evidence?.kind).toBe("unavailableStudents");
    if (!evidence || evidence.kind !== "unavailableStudents") return;
    expect(evidence.students.map((row) => row.studentUserId).sort()).toEqual(
      [missingA, missingB].sort(),
    );
    expect(affectedStudentIdsFromEvidence(evidence).sort()).toEqual([missingA, missingB].sort());
  });

  test("buildUnavailableStudentsEvidence lists referencing constraints", () => {
    const studentId = "student" as Id<"users">;
    const constraints = [
      constraint(0, {
        type: "teammate",
        polarity: "must",
        studentUserId: "other" as Id<"users">,
        otherStudentUserId: studentId,
      }),
    ];
    const evidence = buildUnavailableStudentsEvidence([studentId], constraints);
    expect(evidence.students[0]?.referencingConstraints[0]?.roles).toContain("other");
  });
});
