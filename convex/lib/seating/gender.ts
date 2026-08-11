import type { Doc } from "../../_generated/dataModel.js";
import type { GenderBucket, GenderParityAssignment } from "./types.js";

export function genderBucketFromRoster(
  gender: Doc<"studentRosters">["gender"] | undefined,
): GenderBucket {
  switch (gender) {
    case "male":
    case "transMale":
      return "m";
    case "female":
    case "transFemale":
      return "f";
    case "nonBinary":
    case "selfDescribe":
    case "preferNotToSay":
      return "other";
    default:
      return "unknown";
  }
}

/** Deterministic pseudo-random from seed string. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignGenderParity(args: {
  randomSeed: string;
  mode: "off" | "oddEven";
}): GenderParityAssignment {
  if (args.mode === "off") {
    return { malesOnOddDesks: true };
  }
  const hash = hashSeed(args.randomSeed);
  return { malesOnOddDesks: hash % 2 === 0 };
}
