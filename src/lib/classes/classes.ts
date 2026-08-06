import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";

/** Class document from get / mutations (no membership role). */
export type ClassDoc = NonNullable<FunctionReturnType<typeof api.classes.get>>;

/** Home-list class with the viewer's membership role for O(1) UI gating. */
export type ClassPublic = FunctionReturnType<typeof api.classes.listMine>[number] & {
  /** Present when optimistic create is in flight. */
  _pending?: boolean;
};

export function isClassArchived(classDoc: Pick<ClassDoc, "archivedAt">): boolean {
  return classDoc.archivedAt !== undefined;
}

export function isPendingClass(classDoc: Pick<ClassPublic, "_pending" | "_id">): boolean {
  return classDoc._pending === true || String(classDoc._id).startsWith("optimistic");
}

export function sortClasses(classes: Array<ClassPublic>, language: string): Array<ClassPublic> {
  const collator = new Intl.Collator(language, { sensitivity: "base" });
  return [...classes].sort((a, b) => collator.compare(a.name, b.name));
}

export function slugifyClassName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function getClassUpdatedAt(
  classDoc: Pick<ClassDoc, "updatedAt" | "_creationTime">,
): number | undefined {
  if (typeof classDoc.updatedAt === "number") {
    return classDoc.updatedAt;
  }
  return classDoc._creationTime;
}

export const CLASS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
