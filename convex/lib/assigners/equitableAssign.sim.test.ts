import { describe, expect, it } from "vite-plus/test";

import {
  assignEquitable,
  buildExperienceCounts,
} from "../../../convex/lib/assigners/equitableAssign";
import type { EquitableGenderBucket } from "../../../convex/lib/assigners/equitableGenderBuckets";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SimStudent = {
  id: string;
  gender: EquitableGenderBucket;
  groupId?: string;
};

type EquitablePriorAssignment = {
  studentUserId: string;
  item: string;
  groupId?: string;
  groupName?: string;
  runKey?: string;
};

function simulateRuns(args: {
  students: SimStudent[];
  items: string[];
  runs: number;
  scope: "class" | "groups";
  balanceGender: boolean;
  genderBuckets?: EquitableGenderBucket[];
  seed: number;
}) {
  const rng = mulberry32(args.seed);
  let prior: EquitablePriorAssignment[] = [];

  for (let run = 0; run < args.runs; run += 1) {
    const batch = assignEquitable({
      items: args.items,
      recipients: args.students.map((student, index) => ({
        studentUserId: student.id,
        genderBucket: student.gender,
        groupId: student.groupId,
        groupName: student.groupId,
        rosterNumber: index + 1,
      })),
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets: args.genderBuckets,
      priorAssignments: prior,
      random: rng,
      runCount: run,
    });
    prior = [...prior, ...batch.map((row) => ({ ...row, runKey: `r${run}` }))];
  }

  return prior;
}

function maxSpread(counts: number[]): number {
  if (counts.length === 0) return 0;
  return Math.max(...counts) - Math.min(...counts);
}

type SimScenario = {
  name: string;
  scope: "class" | "groups";
  balanceGender: boolean;
  students: number;
  items: number;
  groupCount?: number;
  runs: number;
};

const GENDER_BUCKETS = ["m", "f", "other"] as const;

/** Fixed, varied 32-bit seeds so failures stay reproducible across many PRNG trajectories. */
const SIMULATION_SEEDS = [
  0x0000_0001, 0x0000_00ad, 0x0000_162e, 0x0000_beef, 0x0001_2345, 0x0010_c0de, 0x00a5_5a5a,
  0x0123_4567, 0x0bad_f00d, 0x0f0f_0f0f, 0x1111_1111, 0x1234_abcd, 0x1a2b_3c4d, 0x2468_ace0,
  0x3141_5926, 0x3c6e_f372, 0x4141_4141, 0x4a7b_c9de, 0x5555_aaaa, 0x5e87_9b2c, 0x60d5_e8a1,
  0x6d2b_79f5, 0x7f4a_2c91, 0x89abcdef, 0x90abcdef, 0x9e3779b9, 0xa5a5_a5a5, 0xb16b_00b5,
  0xc0ffee00, 0xcafebabe, 0xd00d_face, 0xdead_beef, 0xe1e2_e3e4, 0xefcd_ab89, 0xf0e1_d2c3,
  0xf7c2_a1b0, 0xfeed_face, 0xff00_ff00, 0xffff_0001, 0xffff_fffe,
] as const;

const SIMULATION_SCENARIOS: SimScenario[] = [
  // Class, gender off
  {
    name: "class-tiny-single-item",
    scope: "class",
    balanceGender: false,
    students: 3,
    items: 1,
    runs: 50,
  },
  {
    name: "class-slots-limited",
    scope: "class",
    balanceGender: false,
    students: 5,
    items: 8,
    runs: 50,
  },
  {
    name: "class-moderate",
    scope: "class",
    balanceGender: false,
    students: 12,
    items: 3,
    runs: 50,
  },
  { name: "class-large", scope: "class", balanceGender: false, students: 31, items: 7, runs: 50 },
  // Class, gender on
  {
    name: "class-gender-small",
    scope: "class",
    balanceGender: true,
    students: 6,
    items: 1,
    runs: 50,
  },
  {
    name: "class-gender-moderate",
    scope: "class",
    balanceGender: true,
    students: 11,
    items: 2,
    runs: 50,
  },
  {
    name: "class-gender-wide",
    scope: "class",
    balanceGender: true,
    students: 17,
    items: 5,
    runs: 50,
  },
  {
    name: "class-gender-large",
    scope: "class",
    balanceGender: true,
    students: 32,
    items: 8,
    runs: 50,
  },
  // Groups, gender off
  {
    name: "groups-single-group",
    scope: "groups",
    balanceGender: false,
    students: 4,
    items: 2,
    groupCount: 1,
    runs: 50,
  },
  {
    name: "groups-two-small",
    scope: "groups",
    balanceGender: false,
    students: 8,
    items: 1,
    groupCount: 2,
    runs: 50,
  },
  {
    name: "groups-uneven",
    scope: "groups",
    balanceGender: false,
    students: 11,
    items: 4,
    groupCount: 3,
    runs: 50,
  },
  {
    name: "groups-large-many",
    scope: "groups",
    balanceGender: false,
    students: 37,
    items: 8,
    groupCount: 7,
    runs: 50,
  },
  // Groups, gender on
  {
    name: "groups-gender-single",
    scope: "groups",
    balanceGender: true,
    students: 5,
    items: 1,
    groupCount: 1,
    runs: 50,
  },
  {
    name: "groups-gender-two",
    scope: "groups",
    balanceGender: true,
    students: 10,
    items: 2,
    groupCount: 2,
    runs: 50,
  },
  {
    name: "groups-gender-medium",
    scope: "groups",
    balanceGender: true,
    students: 23,
    items: 5,
    groupCount: 4,
    runs: 50,
  },
  {
    name: "groups-gender-large",
    scope: "groups",
    balanceGender: true,
    students: 41,
    items: 7,
    groupCount: 6,
    runs: 50,
  },
];

/** Groups-only churn: students move between groups but always remain on the roster with a group. */
const GROUP_CHURN_SCENARIOS: SimScenario[] = [
  {
    name: "groups-churn-g2",
    scope: "groups",
    balanceGender: false,
    students: 8,
    items: 3,
    groupCount: 2,
    runs: 50,
  },
  {
    name: "groups-churn-g3",
    scope: "groups",
    balanceGender: false,
    students: 12,
    items: 3,
    groupCount: 3,
    runs: 50,
  },
  {
    name: "groups-churn-g4",
    scope: "groups",
    balanceGender: false,
    students: 16,
    items: 4,
    groupCount: 4,
    runs: 50,
  },
  {
    name: "groups-churn-g5",
    scope: "groups",
    balanceGender: false,
    students: 20,
    items: 5,
    groupCount: 5,
    runs: 50,
  },
  {
    name: "groups-churn-items-g2",
    scope: "groups",
    balanceGender: false,
    students: 8,
    items: 12,
    groupCount: 2,
    runs: 50,
  },
  {
    name: "groups-churn-items-g3",
    scope: "groups",
    balanceGender: false,
    students: 12,
    items: 18,
    groupCount: 3,
    runs: 50,
  },
  {
    name: "groups-churn-items-g4",
    scope: "groups",
    balanceGender: false,
    students: 16,
    items: 24,
    groupCount: 4,
    runs: 50,
  },
  {
    name: "groups-churn-items-g5",
    scope: "groups",
    balanceGender: false,
    students: 20,
    items: 30,
    groupCount: 5,
    runs: 50,
  },
];

/** Group churn where some students remain ungrouped (groups scope skips them). */
const GROUP_PARTIAL_CHURN_SCENARIOS: SimScenario[] = [
  {
    name: "groups-churn-partial-g2",
    scope: "groups",
    balanceGender: false,
    students: 10,
    items: 3,
    groupCount: 2,
    runs: 50,
  },
  {
    name: "groups-churn-partial-g3",
    scope: "groups",
    balanceGender: false,
    students: 15,
    items: 3,
    groupCount: 3,
    runs: 50,
  },
  {
    name: "groups-churn-partial-g4",
    scope: "groups",
    balanceGender: false,
    students: 16,
    items: 4,
    groupCount: 4,
    runs: 50,
  },
  {
    name: "groups-churn-partial-g5",
    scope: "groups",
    balanceGender: false,
    students: 20,
    items: 5,
    groupCount: 5,
    runs: 50,
  },
];

function studentIndex(studentId: string): number {
  return Number(studentId.replace("s", ""));
}

function isPermanentUngrouped(studentId: string): boolean {
  return studentIndex(studentId) % 5 === 0;
}

function buildPartialGroupChurnStudents(cfg: SimScenario): SimStudent[] {
  const groupCount = cfg.groupCount ?? 1;
  const students: SimStudent[] = [];

  for (let i = 0; i < cfg.students; i += 1) {
    const gender: EquitableGenderBucket = i % 4 === 0 ? "other" : i % 2 === 0 ? "m" : "f";
    students.push({
      id: `s${i}`,
      gender,
      groupId: isPermanentUngrouped(`s${i}`) ? undefined : `g${i % groupCount}`,
    });
  }

  return students;
}

function buildScenarioStudents(cfg: SimScenario): SimStudent[] {
  const groupCount = cfg.scope === "groups" ? (cfg.groupCount ?? 1) : 0;
  const students: SimStudent[] = [];

  for (let i = 0; i < cfg.students; i += 1) {
    const gender: EquitableGenderBucket = i % 4 === 0 ? "other" : i % 2 === 0 ? "m" : "f";
    students.push({
      id: `s${i}`,
      gender,
      groupId: groupCount > 0 ? `g${i % groupCount}` : undefined,
    });
  }

  return students;
}

type FairnessCohort = {
  label: string;
  students: SimStudent[];
};

function buildFairnessCohorts(cfg: SimScenario, students: SimStudent[]): FairnessCohort[] {
  if (cfg.scope === "class") {
    if (cfg.balanceGender) {
      return GENDER_BUCKETS.map((gender) => ({
        label: `gender:${gender}`,
        students: students.filter((student) => student.gender === gender),
      })).filter((cohort) => cohort.students.length > 0);
    }

    return [{ label: "class", students }];
  }

  const groupCount = cfg.groupCount ?? 1;
  const cohorts: FairnessCohort[] = [];

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupId = `g${groupIndex}`;
    const groupStudents = students.filter((student) => student.groupId === groupId);
    if (groupStudents.length === 0) continue;

    if (cfg.balanceGender) {
      for (const gender of GENDER_BUCKETS) {
        const genderStudents = groupStudents.filter((student) => student.gender === gender);
        if (genderStudents.length === 0) continue;
        cohorts.push({
          label: `group:${groupId}:gender:${gender}`,
          students: genderStudents,
        });
      }
      continue;
    }

    cohorts.push({ label: `group:${groupId}`, students: groupStudents });
  }

  return cohorts;
}

function applySeedDrivenGroupChurn(
  students: SimStudent[],
  groupCount: number,
  rng: () => number,
): SimStudent[] {
  if (groupCount <= 1) return students;

  return students.map((student) => {
    if (!student.groupId) return student;
    if (rng() >= 0.2) return student;

    const currentIndex = Number(student.groupId?.replace("g", "") ?? 0);
    let nextIndex = Math.floor(rng() * groupCount);
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(rng() * groupCount);
    }

    return { ...student, groupId: `g${nextIndex}` };
  });
}

function applySeedDrivenPartialGroupChurn(
  students: SimStudent[],
  groupCount: number,
  rng: () => number,
): SimStudent[] {
  return students.map((student) => {
    if (isPermanentUngrouped(student.id)) {
      return { ...student, groupId: undefined };
    }

    if (!student.groupId) {
      if (rng() < 0.25) {
        return { ...student, groupId: `g${Math.floor(rng() * groupCount)}` };
      }
      return student;
    }

    if (rng() < 0.1) {
      return { ...student, groupId: undefined };
    }

    if (groupCount > 1 && rng() < 0.2) {
      const currentIndex = Number(student.groupId.replace("g", ""));
      let nextIndex = Math.floor(rng() * groupCount);
      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(rng() * groupCount);
      }
      return { ...student, groupId: `g${nextIndex}` };
    }

    return student;
  });
}

function expectChurnPriority(args: {
  cfg: SimScenario;
  students: SimStudent[];
  prior: EquitablePriorAssignment[];
  batch: EquitablePriorAssignment[];
  seed: number;
  run: number;
}): void {
  const experience = buildExperienceCounts(args.prior);
  const studentById = new Map(args.students.map((student) => [student.id, student]));
  const cohorts = buildFairnessCohorts(args.cfg, args.students);

  for (const cohort of cohorts) {
    const eligibleIds = new Set(cohort.students.map((student) => student.id));
    const selectedIds = new Set(
      args.batch
        .filter((row) => {
          const student = studentById.get(row.studentUserId);
          return student ? eligibleIds.has(student.id) : false;
        })
        .map((row) => row.studentUserId),
    );
    const expectedAssignments = Math.min(args.cfg.items, cohort.students.length);
    const context = `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${args.run} cohort=${cohort.label}`;

    expect(selectedIds.size, `${context} filled assignments`).toBe(expectedAssignments);

    const selectedTotals = cohort.students
      .filter((student) => selectedIds.has(student.id))
      .map((student) => experience.totalByStudent.get(student.id) ?? 0);
    const unselectedTotals = cohort.students
      .filter((student) => !selectedIds.has(student.id))
      .map((student) => experience.totalByStudent.get(student.id) ?? 0);

    if (selectedTotals.length > 0 && unselectedTotals.length > 0) {
      expect(
        Math.max(...selectedTotals),
        `${context} bypassed lower-history student`,
      ).toBeLessThanOrEqual(Math.min(...unselectedTotals));
    }
  }
}

function simulateGroupChurnRuns(args: {
  cfg: SimScenario;
  students: SimStudent[];
  items: string[];
  seed: number;
}) {
  const groupCount = args.cfg.groupCount ?? 1;
  const rng = mulberry32(args.seed);
  let students = args.students.map((student) => ({ ...student }));
  let prior: EquitablePriorAssignment[] = [];

  for (let run = 0; run < args.cfg.runs; run += 1) {
    students = applySeedDrivenGroupChurn(students, groupCount, rng);

    for (const student of students) {
      expect(
        student.groupId,
        `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run}`,
      ).toBeTruthy();
    }

    const batch = assignEquitable({
      items: args.items,
      recipients: students.map((student, index) => ({
        studentUserId: student.id,
        genderBucket: student.gender,
        groupId: student.groupId,
        groupName: student.groupId,
        rosterNumber: index + 1,
      })),
      scope: "groups",
      balanceGender: args.cfg.balanceGender,
      genderBuckets: [...GENDER_BUCKETS],
      priorAssignments: prior,
      random: rng,
      runCount: run,
    });

    const ids = batch.map((row) => row.studentUserId);
    expect(
      new Set(ids).size,
      `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run} duplicate assignees`,
    ).toBe(ids.length);

    expectChurnPriority({
      cfg: args.cfg,
      students,
      prior,
      batch,
      seed: args.seed,
      run,
    });
    prior = [...prior, ...batch.map((row) => ({ ...row, runKey: `r${run}` }))];
  }

  return prior;
}

function simulatePartialGroupChurnRuns(args: {
  cfg: SimScenario;
  students: SimStudent[];
  items: string[];
  seed: number;
}) {
  const groupCount = args.cfg.groupCount ?? 1;
  const rng = mulberry32(args.seed);
  let students = args.students.map((student) => ({ ...student }));
  let prior: EquitablePriorAssignment[] = [];

  for (let run = 0; run < args.cfg.runs; run += 1) {
    students = applySeedDrivenPartialGroupChurn(students, groupCount, rng);

    const ungroupedIds = new Set(
      students.filter((student) => !student.groupId).map((student) => student.id),
    );
    expect(
      ungroupedIds.size,
      `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run} ungrouped students`,
    ).toBeGreaterThan(0);
    expect(
      students.some((student) => student.groupId),
      `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run} grouped students`,
    ).toBe(true);

    const batch = assignEquitable({
      items: args.items,
      recipients: students.map((student, index) => ({
        studentUserId: student.id,
        genderBucket: student.gender,
        groupId: student.groupId,
        groupName: student.groupId,
        rosterNumber: index + 1,
      })),
      scope: "groups",
      balanceGender: args.cfg.balanceGender,
      genderBuckets: [...GENDER_BUCKETS],
      priorAssignments: prior,
      random: rng,
      runCount: run,
    });

    const ids = batch.map((row) => row.studentUserId);
    expect(
      new Set(ids).size,
      `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run} duplicate assignees`,
    ).toBe(ids.length);

    for (const row of batch) {
      expect(
        ungroupedIds.has(row.studentUserId),
        `${args.cfg.name} seed=0x${args.seed.toString(16)} run=${run} ungrouped assignee ${row.studentUserId}`,
      ).toBe(false);
    }

    expectChurnPriority({
      cfg: args.cfg,
      students,
      prior,
      batch,
      seed: args.seed,
      run,
    });
    prior = [...prior, ...batch.map((row) => ({ ...row, runKey: `r${run}` }))];
  }

  return prior;
}

function expectPairMixing(args: {
  cfg: SimScenario;
  students: SimStudent[];
  prior: EquitablePriorAssignment[];
  seed: number;
}): void {
  if (!args.cfg.balanceGender || args.cfg.items < 2) return;

  const pools = new Map<string, SimStudent[]>();
  if (args.cfg.scope === "groups") {
    for (const student of args.students) {
      if (!student.groupId) continue;
      const list = pools.get(student.groupId) ?? [];
      list.push(student);
      pools.set(student.groupId, list);
    }
  } else {
    pools.set("class", args.students);
  }

  const byRun = new Map<string, EquitablePriorAssignment[]>();
  for (const row of args.prior) {
    if (!row.runKey) continue;
    const list = byRun.get(row.runKey) ?? [];
    list.push(row);
    byRun.set(row.runKey, list);
  }

  for (const [poolId, poolStudents] of pools) {
    const byGender = new Map<EquitableGenderBucket, SimStudent[]>();
    for (const student of poolStudents) {
      const list = byGender.get(student.gender) ?? [];
      list.push(student);
      byGender.set(student.gender, list);
    }
    const remixGenders = [...byGender.entries()].filter(([, list]) => list.length >= 2);
    if (remixGenders.length < 2) continue;

    const remixIds = new Set(remixGenders.flatMap(([, list]) => list.map((student) => student.id)));
    const genderById = new Map(poolStudents.map((student) => [student.id, student.gender]));
    const mixedPairs = new Set<string>();
    for (let i = 0; i < remixGenders.length; i += 1) {
      for (let j = i + 1; j < remixGenders.length; j += 1) {
        for (const a of remixGenders[i]![1]) {
          for (const b of remixGenders[j]![1]) {
            mixedPairs.add(a.id < b.id ? `${a.id}::${b.id}` : `${b.id}::${a.id}`);
          }
        }
      }
    }

    const together = new Map<string, number>();
    const bothWorked = new Map<string, number>();

    for (const rows of byRun.values()) {
      const poolRows = rows.filter((row) => {
        if (!remixIds.has(row.studentUserId)) return false;
        if (args.cfg.scope === "groups") return row.groupId === poolId;
        return true;
      });
      const assigned = new Set(poolRows.map((row) => row.studentUserId));
      for (const pair of mixedPairs) {
        const separator = pair.indexOf("::");
        const a = pair.slice(0, separator);
        const b = pair.slice(separator + 2);
        if (assigned.has(a) && assigned.has(b)) {
          bothWorked.set(pair, (bothWorked.get(pair) ?? 0) + 1);
        }
      }

      const byItem = new Map<string, string[]>();
      for (const row of poolRows) {
        const list = byItem.get(row.item) ?? [];
        list.push(row.studentUserId);
        byItem.set(row.item, list);
      }
      for (const studentsOnItem of byItem.values()) {
        for (let i = 0; i < studentsOnItem.length; i += 1) {
          for (let j = i + 1; j < studentsOnItem.length; j += 1) {
            const a = studentsOnItem[i]!;
            const b = studentsOnItem[j]!;
            if (genderById.get(a) === genderById.get(b)) continue;
            const pair = a < b ? `${a}::${b}` : `${b}::${a}`;
            if (!mixedPairs.has(pair)) continue;
            together.set(pair, (together.get(pair) ?? 0) + 1);
          }
        }
      }
    }

    for (const pair of mixedPairs) {
      const worked = bothWorked.get(pair) ?? 0;
      if (worked < 6) continue;
      const shared = together.get(pair) ?? 0;
      expect(
        shared,
        `${args.cfg.name} seed=0x${args.seed.toString(16)} pool=${poolId} pair=${pair} locked together`,
      ).toBeLessThan(worked);
    }
  }
}

function expectFairnessInvariants(args: {
  scenarioName: string;
  seed: number;
  run?: number;
  cohort: FairnessCohort;
  items: string[];
  experience: ReturnType<typeof buildExperienceCounts>;
}) {
  const runLabel = args.run === undefined ? "" : ` run=${args.run}`;
  const context = `${args.scenarioName} seed=0x${args.seed.toString(16)}${runLabel} cohort=${args.cohort.label}`;
  const totals = args.cohort.students.map(
    (student) => args.experience.totalByStudent.get(student.id) ?? 0,
  );

  expectCountsNearOptimal(totals, `${context} totals`, {
    maximumFairShareDeviation: 1,
    maximumSpread: 2,
  });

  for (const item of args.items) {
    const itemCounts = args.cohort.students.map(
      (student) => args.experience.itemByStudent.get(student.id)?.get(item) ?? 0,
    );
    // Total workload is the primary objective; individual item rotation is secondary.
    // The greedy matcher is therefore allowed one additional count of item-level slack.
    expectCountsNearOptimal(itemCounts, `${context} item=${item}`, {
      maximumFairShareDeviation: 2,
      maximumSpread: 2,
    });
  }
}

function expectCountsNearOptimal(
  counts: number[],
  context: string,
  bounds: {
    maximumFairShareDeviation: number;
    maximumSpread: number;
  },
): void {
  if (counts.length === 0) return;
  const total = counts.reduce((sum, count) => sum + count, 0);
  const fairShare = total / counts.length;
  const optimalSpread = total % counts.length === 0 ? 0 : 1;

  for (const count of counts) {
    expect(Math.abs(count - fairShare), `${context} fair-share deviation`).toBeLessThanOrEqual(
      bounds.maximumFairShareDeviation,
    );
  }
  expect(maxSpread(counts), `${context} spread vs optimum`).toBeLessThanOrEqual(
    Math.max(optimalSpread, bounds.maximumSpread),
  );
}

describe.each(SIMULATION_SCENARIOS)("$name", (cfg) => {
  it(`maintains fairness invariants (${cfg.students} students, ${cfg.items} items${
    cfg.groupCount ? `, ${cfg.groupCount} groups` : ""
  }) across seeds`, () => {
    const students = buildScenarioStudents(cfg);
    const items = Array.from({ length: cfg.items }, (_, index) => `Item${index + 1}`);
    const cohorts = buildFairnessCohorts(cfg, students);

    for (const seed of SIMULATION_SEEDS) {
      const prior = simulateRuns({
        students,
        items,
        runs: cfg.runs,
        scope: cfg.scope,
        balanceGender: cfg.balanceGender,
        genderBuckets: [...GENDER_BUCKETS],
        seed,
      });

      const experience = buildExperienceCounts(prior);

      expectPairMixing({
        cfg,
        students,
        prior,
        seed,
      });

      for (const cohort of cohorts) {
        expectFairnessInvariants({
          scenarioName: cfg.name,
          seed,
          cohort,
          items,
          experience,
        });
      }
    }
  });
});

describe.each(GROUP_CHURN_SCENARIOS)("$name", (cfg) => {
  it(`never bypasses lower-history students while groups change (${cfg.students} students, ${cfg.items} items, ${cfg.groupCount} groups) across seeds`, () => {
    const students = buildScenarioStudents(cfg);
    const items = Array.from({ length: cfg.items }, (_, index) => `Item${index + 1}`);

    for (const seed of SIMULATION_SEEDS) {
      simulateGroupChurnRuns({
        cfg,
        students,
        items,
        seed,
      });
    }
  });
});

describe.each(GROUP_PARTIAL_CHURN_SCENARIOS)("$name", (cfg) => {
  it(`preserves global priority while students leave and rejoin groups (${cfg.students} students, ${cfg.items} items, ${cfg.groupCount} groups) across seeds`, () => {
    const students = buildPartialGroupChurnStudents(cfg);
    const items = Array.from({ length: cfg.items }, (_, index) => `Item${index + 1}`);

    for (const seed of SIMULATION_SEEDS) {
      simulatePartialGroupChurnRuns({
        cfg,
        students,
        items,
        seed,
      });
    }
  });
});
