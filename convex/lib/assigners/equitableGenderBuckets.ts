import { z } from "zod";

export type EquitableGenderBucket = "m" | "f" | "other" | "unknown";

export const ALL_EQUITABLE_GENDER_BUCKETS: readonly EquitableGenderBucket[] = [
  "m",
  "f",
  "other",
  "unknown",
];

export const equitableGenderBucketSchema = z.union([
  z.literal("m"),
  z.literal("f"),
  z.literal("other"),
  z.literal("unknown"),
]);

export const equitableGenderBucketsSchema = z
  .array(equitableGenderBucketSchema)
  .min(1, "Select at least one gender bucket");

export function normalizeEquitableGenderBuckets(
  buckets: ReadonlyArray<EquitableGenderBucket> | undefined,
): EquitableGenderBucket[] {
  if (!buckets || buckets.length === 0) {
    return [...ALL_EQUITABLE_GENDER_BUCKETS];
  }
  const seen = new Set<EquitableGenderBucket>();
  const normalized: EquitableGenderBucket[] = [];
  for (const bucket of buckets) {
    if (!ALL_EQUITABLE_GENDER_BUCKETS.includes(bucket)) continue;
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    normalized.push(bucket);
  }
  return normalized.length > 0 ? normalized : [...ALL_EQUITABLE_GENDER_BUCKETS];
}

export function equitableGenderBucketsEqual(
  a: ReadonlyArray<EquitableGenderBucket>,
  b: ReadonlyArray<EquitableGenderBucket>,
): boolean {
  const normalizedA = normalizeEquitableGenderBuckets(a);
  const normalizedB = normalizeEquitableGenderBuckets(b);
  if (normalizedA.length !== normalizedB.length) return false;
  return normalizedA.every((bucket, index) => bucket === normalizedB[index]);
}
