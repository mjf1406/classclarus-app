import { parseDueDateKey } from "@/lib/dueDate/dueDateKey";

export type ReleaseMode = "released" | "hidden" | "scheduled";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Epoch ms -> `YYYY-MM-DDTHH:mm` local string for `<input type="datetime-local">`. */
export function msToDatetimeLocal(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function releaseModeFromDoc(doc: {
  hiddenFromStudents?: boolean;
  scheduledReleaseAt?: number;
}): ReleaseMode {
  if (doc.scheduledReleaseAt !== undefined) return "scheduled";
  if (doc.hiddenFromStudents === true) return "hidden";
  return "released";
}

export function releasePayloadFromForm(values: {
  releaseMode: ReleaseMode;
  scheduledReleaseAt?: string;
}): { hiddenFromStudents: boolean; scheduledReleaseAt?: number } {
  if (values.releaseMode === "released") {
    return { hiddenFromStudents: false };
  }
  if (values.releaseMode === "hidden") {
    return { hiddenFromStudents: true };
  }
  const parsed = parseDueDateKey(values.scheduledReleaseAt?.trim() ?? "");
  if (!parsed) {
    throw new Error("Choose a release date and time.");
  }
  return { hiddenFromStudents: true, scheduledReleaseAt: parsed.getTime() };
}
