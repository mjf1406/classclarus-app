/** Marker domain for admin-seeded test roster accounts (not real mailboxes). */
export const SEED_STUDENT_EMAIL_DOMAIN = "classclarus.seed";

export function isSeedStudentEmail(email: string | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${SEED_STUDENT_EMAIL_DOMAIN}`);
}

export function buildSeedStudentEmail(args: {
  classId: string;
  gender: "male" | "female";
  index: number;
  nonce: string;
}): string {
  return `seed.${args.classId}.${args.gender}.${args.index}.${args.nonce}@${SEED_STUDENT_EMAIL_DOMAIN}`;
}

const BOY_FIRST_NAMES = [
  "Liam",
  "Noah",
  "Oliver",
  "James",
  "Elijah",
  "William",
  "Henry",
  "Lucas",
  "Benjamin",
  "Theodore",
  "Jack",
  "Levi",
  "Alexander",
  "Owen",
  "Samuel",
  "Sebastian",
  "Daniel",
  "Matthew",
  "Joseph",
  "David",
  "Carter",
  "Wyatt",
  "John",
  "Luke",
  "Jayden",
  "Dylan",
  "Grayson",
  "Leo",
  "Julian",
  "Isaac",
] as const;

const GIRL_FIRST_NAMES = [
  "Olivia",
  "Emma",
  "Amelia",
  "Charlotte",
  "Sophia",
  "Isabella",
  "Mia",
  "Evelyn",
  "Harper",
  "Luna",
  "Camila",
  "Gianna",
  "Elizabeth",
  "Eleanor",
  "Ella",
  "Abigail",
  "Sofia",
  "Avery",
  "Scarlett",
  "Emily",
  "Aria",
  "Penelope",
  "Chloe",
  "Layla",
  "Mila",
  "Nora",
  "Hazel",
  "Madison",
  "Ellie",
  "Lily",
] as const;

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
] as const;

export type SeedStudentPlan = {
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  pronouns: "heHim" | "sheHer";
  email: string;
  displayName: string;
};

function pickName(pool: readonly string[], index: number, offset: number): string {
  return pool[(index + offset) % pool.length]!;
}

/**
 * Build a deterministic roster plan for seeding. Names cycle through fixed pools;
 * emails are unique per class / gender / index / nonce.
 */
export function planSeedTestStudents(args: {
  classId: string;
  boyCount: number;
  girlCount: number;
  namePrefix?: string;
  nonce: string;
}): SeedStudentPlan[] {
  const prefix = args.namePrefix?.trim() ?? "";
  const plans: SeedStudentPlan[] = [];

  for (let i = 0; i < args.boyCount; i++) {
    const firstName = pickName(BOY_FIRST_NAMES, i, 0);
    const lastName = pickName(LAST_NAMES, i, 3);
    const rosterFirst = prefix ? `${prefix}${firstName}` : firstName;
    plans.push({
      firstName: rosterFirst,
      lastName,
      gender: "male",
      pronouns: "heHim",
      email: buildSeedStudentEmail({
        classId: args.classId,
        gender: "male",
        index: i + 1,
        nonce: args.nonce,
      }),
      displayName: `${rosterFirst} ${lastName}`,
    });
  }

  for (let i = 0; i < args.girlCount; i++) {
    const firstName = pickName(GIRL_FIRST_NAMES, i, 0);
    const lastName = pickName(LAST_NAMES, i, 7);
    const rosterFirst = prefix ? `${prefix}${firstName}` : firstName;
    plans.push({
      firstName: rosterFirst,
      lastName,
      gender: "female",
      pronouns: "sheHer",
      email: buildSeedStudentEmail({
        classId: args.classId,
        gender: "female",
        index: i + 1,
        nonce: args.nonce,
      }),
      displayName: `${rosterFirst} ${lastName}`,
    });
  }

  return plans;
}
