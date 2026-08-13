import type { Id } from "../../_generated/dataModel.js";
import {
  TEST_CLASSROOM_GROUP_ID,
  TEST_CLASSROOM_LAYOUT_ID,
  classroomStudent,
  classroomStudents,
  genderBucketForIndex,
  grid4x5,
  grid5x6,
  parityStress20,
  uShape24,
  type ClassroomLayoutFixture,
} from "./classroomLayouts.js";
import { classroomSlotsFromItems, testInput, testStudent } from "./seatingTestHelpers.js";
import type { SeatingAlgorithmInput, SeatingConstraint, SeatingStudent } from "./types.js";

export type SimLayoutKind = "grid4x5" | "grid5x6" | "uShape24" | "parityStress20";

export type SimScenario = {
  name: string;
  studentCount: number;
  slotCount: number;
  topology?: "line" | "ring" | "complete";
  layout?: SimLayoutKind;
  lockCount?: number;
  lockFirst?: boolean;
  parity?: "off" | "oddEven";
  constraints?: boolean;
  /** Use males + unknown only so unnumbered desks remain feasible under parity. */
  parityUnnumberedRoster?: boolean;
  runs: number;
};

export const DEFAULT_SCENARIOS: SimScenario[] = [
  { name: "line-tiny", studentCount: 6, slotCount: 6, topology: "line", runs: 20 },
  { name: "ring-moderate", studentCount: 8, slotCount: 8, topology: "ring", runs: 20 },
  { name: "complete-rotation", studentCount: 8, slotCount: 8, topology: "complete", runs: 20 },
  { name: "scarce-seats", studentCount: 7, slotCount: 4, topology: "line", runs: 20 },
  {
    name: "locked-ring",
    studentCount: 5,
    slotCount: 5,
    topology: "ring",
    lockFirst: true,
    runs: 20,
  },
  {
    name: "parity-line",
    studentCount: 6,
    slotCount: 6,
    topology: "line",
    parity: "oddEven",
    runs: 12,
  },
  { name: "grid-20", studentCount: 20, slotCount: 20, layout: "grid4x5", runs: 5 },
  {
    name: "realistic-class",
    studentCount: 28,
    slotCount: 30,
    layout: "grid5x6",
    lockCount: 4,
    parity: "oddEven",
    constraints: true,
    runs: 6,
  },
  {
    name: "crowded-realistic",
    studentCount: 32,
    slotCount: 30,
    layout: "grid5x6",
    lockCount: 4,
    parity: "oddEven",
    constraints: true,
    runs: 3,
  },
  {
    name: "ushape-constrained",
    studentCount: 20,
    slotCount: 24,
    layout: "uShape24",
    lockCount: 3,
    parity: "oddEven",
    constraints: true,
    runs: 6,
  },
  {
    name: "parity-unnumbered",
    studentCount: 20,
    slotCount: 20,
    layout: "parityStress20",
    parity: "oddEven",
    parityUnnumberedRoster: true,
    runs: 6,
  },
];

export const SOAK_SCENARIOS: SimScenario[] = [
  { name: "soak-grid-20", studentCount: 20, slotCount: 20, layout: "grid4x5", runs: 12 },
  { name: "soak-scarce-grid", studentCount: 30, slotCount: 20, layout: "grid4x5", runs: 8 },
];

export const FEASIBLE_SEED_SWEEP_SCENARIOS: SimScenario[] = [
  ...DEFAULT_SCENARIOS.filter(
    (scenario) =>
      scenario.studentCount <= scenario.slotCount &&
      (scenario.name === "realistic-class" ||
        scenario.name === "ushape-constrained" ||
        scenario.name === "parity-unnumbered" ||
        scenario.name === "grid-20" ||
        scenario.name === "parity-line"),
  ).map((scenario) => ({ ...scenario, runs: 1 })),
];

function layoutFixture(kind: SimLayoutKind): ClassroomLayoutFixture {
  switch (kind) {
    case "grid4x5":
      return grid4x5();
    case "grid5x6":
      return grid5x6();
    case "uShape24":
      return uShape24();
    case "parityStress20":
      return parityStress20();
  }
}

function constraint(index: number, values: Omit<SeatingConstraint, "id">): SeatingConstraint {
  return { id: `constraint-${index}` as Id<"seatConstraints">, ...values };
}

export function compatibleClassroomConstraints(
  students: ReadonlyArray<SeatingStudent>,
): SeatingConstraint[] {
  if (students.length < 14) return [];
  const id = (index: number) => students[index]!.studentUserId;
  return [
    constraint(0, {
      type: "neighbor",
      polarity: "must",
      studentUserId: id(4),
      otherStudentUserId: id(5),
    }),
    constraint(1, {
      type: "neighbor",
      polarity: "mustNot",
      studentUserId: id(6),
      otherStudentUserId: id(7),
    }),
    constraint(2, {
      type: "zone",
      polarity: "must",
      studentUserId: id(8),
      zoneName: "Front",
    }),
    constraint(3, {
      type: "zone",
      polarity: "mustNot",
      studentUserId: id(9),
      zoneName: "Back",
    }),
    constraint(4, {
      type: "teammate",
      polarity: "must",
      studentUserId: id(10),
      otherStudentUserId: id(11),
    }),
    constraint(5, {
      type: "teammate",
      polarity: "mustNot",
      studentUserId: id(12),
      otherStudentUserId: id(13),
    }),
  ];
}

export function studentsForScenario(scenario: SimScenario): SeatingStudent[] {
  if (scenario.parityUnnumberedRoster) {
    return Array.from({ length: scenario.studentCount }, (_, index) =>
      classroomStudent(index, {
        genderBucket: index < Math.ceil(scenario.studentCount / 2) ? "m" : "unknown",
      }),
    );
  }
  if (scenario.layout) {
    return classroomStudents(scenario.studentCount);
  }
  if (scenario.parity === "oddEven") {
    return Array.from({ length: scenario.studentCount }, (_, index) => ({
      ...testStudent(index),
      genderBucket: genderBucketForIndex(index),
    }));
  }
  return Array.from({ length: scenario.studentCount }, (_, index) => testStudent(index));
}

export function locksForScenario(
  scenario: SimScenario,
  students: ReadonlyArray<SeatingStudent>,
  slots: SeatingAlgorithmInput["slots"],
): SeatingAlgorithmInput["locked"] {
  const lockCount = scenario.lockCount ?? (scenario.lockFirst ? 1 : 0);
  if (lockCount <= 0) return [];
  return students.slice(0, lockCount).map((student, index) => ({
    studentUserId: student.studentUserId,
    groupId: student.groupId,
    deskItemId: slots[index]!.deskItemId,
  }));
}

export function buildScenarioInput(args: {
  scenario: SimScenario;
  seed: string;
  history?: SeatingAlgorithmInput["history"];
  locked?: SeatingAlgorithmInput["locked"];
  students?: SeatingStudent[];
  slotCount?: number;
}): SeatingAlgorithmInput {
  const students = args.students ?? studentsForScenario(args.scenario);
  if (args.scenario.layout) {
    const layout = layoutFixture(args.scenario.layout);
    const slots = classroomSlotsFromItems({
      items: layout.items,
      groupIds: [TEST_CLASSROOM_GROUP_ID],
    }).slice(0, args.slotCount ?? args.scenario.slotCount);
    return {
      layoutId: TEST_CLASSROOM_LAYOUT_ID,
      slots,
      students,
      locked: args.locked ?? [],
      constraints: args.scenario.constraints ? compatibleClassroomConstraints(students) : [],
      history: args.history ?? { byStudent: new Map() },
      scope: { kind: "class" },
      genderParityMode: args.scenario.parity ?? "off",
      genderParityAssignment: { malesOnOddDesks: true },
      randomSeed: args.seed,
    };
  }
  return testInput({
    studentCount: args.scenario.studentCount,
    slotCount: args.slotCount ?? args.scenario.slotCount,
    topology: args.scenario.topology,
    seed: args.seed,
    history: args.history,
    locked: args.locked,
    genderParityMode: args.scenario.parity,
    students,
    constraints: args.scenario.constraints ? compatibleClassroomConstraints(students) : [],
  });
}
