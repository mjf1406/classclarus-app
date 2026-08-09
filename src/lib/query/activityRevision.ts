export type ActivityRevision = {
  eventId: string;
  createdAt: number;
} | null;

export function activityRevisionsEqual(a: ActivityRevision, b: ActivityRevision): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.eventId === b.eventId && a.createdAt === b.createdAt;
}
