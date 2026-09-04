import { CheckCircle2, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { listStudentTaskProgress, type TaskListItem } from "@/lib/tasks/tasks";
import { cn } from "@/lib/utils";

type TaskAllDoneOverviewProps = {
  tasks: readonly TaskListItem[];
  roster: readonly StudentRosterEntry[];
  nameFormat: RosterNameFormat;
};

function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function TaskAllDoneOverview({ tasks, roster, nameFormat }: TaskAllDoneOverviewProps) {
  const { t } = useTranslation("tasks");
  const { t: tClasses } = useTranslation("classes");
  const [open, setOpen] = useState(false);
  const unnamed = tClasses("unnamedMember");
  const rows = useMemo(() => listStudentTaskProgress(tasks, roster), [roster, tasks]);
  const rosterById = useMemo(
    () => new Map(roster.map((student) => [String(student.userId), student] as const)),
    [roster],
  );
  /** Least progress first so students needing attention are at the top (ties keep roster order). */
  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.completed - b.completed), [rows]);
  const doneCount = useMemo(
    () => rows.filter((row) => row.total > 0 && row.completed >= row.total).length,
    [rows],
  );
  const summary = t("allDoneSummary", { done: doneCount, total: rows.length });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{t("allDoneOverviewTitle")}</span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{summary}</span>
          </span>
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPercent(doneCount, rows.length)}%` }}
            />
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Credenza open={open} onOpenChange={setOpen}>
        <CredenzaContent>
          <CredenzaHeader>
            <CredenzaTitle>{t("allDoneOverviewTitle")}</CredenzaTitle>
            <CredenzaDescription>{summary}</CredenzaDescription>
          </CredenzaHeader>
          <CredenzaBody className="md:max-h-[60vh]">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("allDoneEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {sortedRows.map((row) => {
                  const student = rosterById.get(row.userId);
                  if (!student) return null;
                  const displayName = getRosterDisplayName(student, unnamed, nameFormat);
                  const allDone = row.total > 0 && row.completed >= row.total;
                  return (
                    <li
                      key={row.userId}
                      className="flex items-center gap-3"
                      aria-label={t("allDoneStudentAria", {
                        name: displayName,
                        completed: row.completed,
                        total: row.total,
                      })}
                    >
                      <span className="w-32 shrink-0 truncate text-sm sm:w-44" title={displayName}>
                        {displayName}
                      </span>
                      <span
                        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                        aria-hidden
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full transition-[width]",
                            allDone ? "bg-green-600 dark:bg-green-400" : "bg-primary",
                          )}
                          style={{ width: `${progressPercent(row.completed, row.total)}%` }}
                        />
                      </span>
                      <span className="flex w-16 shrink-0 items-center justify-end gap-1 text-sm text-muted-foreground tabular-nums">
                        {allDone ? (
                          <CheckCircle2
                            className="size-4 text-green-600 dark:text-green-400"
                            aria-hidden
                          />
                        ) : null}
                        {row.completed}/{row.total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CredenzaBody>
        </CredenzaContent>
      </Credenza>
    </>
  );
}
