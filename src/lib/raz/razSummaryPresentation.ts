import type { RazDisplayStatus } from "@/lib/raz/assessmentSchedule";
import { toIntlLocale } from "@/lib/languages";

export const RAZ_STATUS_I18N_KEY = {
  rti: "statusRti",
  pending: "statusPending",
  overdue: "statusOverdue",
  due_now: "statusDueNow",
  coming_soon: "statusComingSoon",
  up_to_date: "statusUpToDate",
  ineligible: "statusIneligible",
} as const satisfies Record<RazDisplayStatus, string>;

export function razStatusBadgeVariant(
  status: RazDisplayStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "rti":
    case "overdue":
      return "destructive";
    case "due_now":
      return "default";
    case "pending":
    case "coming_soon":
      return "secondary";
    case "up_to_date":
    case "ineligible":
      return "outline";
  }
}

export function formatRazMediumDate(timestampMs: number, language: string): string {
  return new Intl.DateTimeFormat(toIntlLocale(language), { dateStyle: "medium" }).format(
    new Date(timestampMs),
  );
}

export function formatRazMediumDateTime(timestampMs: number, language: string): string {
  return new Intl.DateTimeFormat(toIntlLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}
