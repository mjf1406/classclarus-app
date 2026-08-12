import { describe, expect, test } from "vite-plus/test";

import {
  buildSeedStudentEmail,
  isSeedStudentEmail,
  planSeedTestStudents,
  SEED_STUDENT_EMAIL_DOMAIN,
} from "./seedTestStudents";

describe("seedTestStudents", () => {
  test("marks seed emails by domain", () => {
    expect(isSeedStudentEmail(`a@${SEED_STUDENT_EMAIL_DOMAIN}`)).toBe(true);
    expect(isSeedStudentEmail("real@example.com")).toBe(false);
    expect(isSeedStudentEmail(undefined)).toBe(false);
  });

  test("plans equal boy/girl counts with genders and unique emails", () => {
    const plans = planSeedTestStudents({
      classId: "class123",
      boyCount: 14,
      girlCount: 14,
      nonce: "abc",
    });
    expect(plans).toHaveLength(28);
    expect(plans.filter((p) => p.gender === "male")).toHaveLength(14);
    expect(plans.filter((p) => p.gender === "female")).toHaveLength(14);
    expect(new Set(plans.map((p) => p.email)).size).toBe(28);
    expect(plans[0]?.pronouns).toBe("heHim");
    expect(plans[14]?.pronouns).toBe("sheHer");
  });

  test("applies name prefix to first names", () => {
    const plans = planSeedTestStudents({
      classId: "class123",
      boyCount: 1,
      girlCount: 1,
      namePrefix: "T-",
      nonce: "n1",
    });
    expect(plans[0]?.firstName.startsWith("T-")).toBe(true);
    expect(plans[1]?.firstName.startsWith("T-")).toBe(true);
  });

  test("buildSeedStudentEmail embeds class and gender", () => {
    const email = buildSeedStudentEmail({
      classId: "cid",
      gender: "male",
      index: 2,
      nonce: "x",
    });
    expect(email).toBe(`seed.cid.male.2.x@${SEED_STUDENT_EMAIL_DOMAIN}`);
  });
});
