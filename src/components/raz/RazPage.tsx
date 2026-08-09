import { useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/permissions/useCan";
import { useRazInitialLevels } from "@/hooks/raz/useRazInitialLevels";
import { useStudentRoster } from "@/hooks/roster/useStudentRoster";
import type { Id } from "../../../convex/_generated/dataModel";

const ASSESS_URL = "https://www.raz-plus.com/learninga-z-levels/assessing-a-students-level/";
const CHART_URL = "https://www.raz-kids.com/main/ViewPage/name/level-correlation-chart/";

type RazPageProps = {
  classId: Id<"classes">;
};

export function RazPage({ classId }: RazPageProps) {
  const { t } = useTranslation("raz");
  const navigate = useNavigate();
  const { can, isPending: permissionsPending } = useCan();
  const canManage = !permissionsPending && can("raz:manage");
  const canReadStudents = !permissionsPending && can("students:read");

  const {
    data: levels,
    isPending: levelsPending,
    isError: levelsError,
    refetch: refetchLevels,
  } = useRazInitialLevels(classId);
  const {
    data: roster,
    isPending: rosterPending,
    isError: rosterError,
    refetch: refetchRoster,
  } = useStudentRoster(classId);

  const levelByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of levels ?? []) {
      map.set(row.studentUserId, row.initialLevel);
    }
    return map;
  }, [levels]);

  const { total, remaining, setCount } = useMemo(() => {
    if (!canReadStudents || !roster) {
      return { total: 0, remaining: 0, setCount: 0 };
    }
    let unset = 0;
    for (const student of roster) {
      if (!levelByStudent.has(student.userId)) unset += 1;
    }
    const nextTotal = roster.length;
    return { total: nextTotal, remaining: unset, setCount: nextTotal - unset };
  }, [canReadStudents, levelByStudent, roster]);

  const setupIncomplete = canManage && canReadStudents && total > 0 && remaining > 0;
  const loading =
    permissionsPending ||
    levelsPending ||
    (canManage && canReadStudents && rosterPending && roster === undefined);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (levelsError || (canManage && rosterError)) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void refetchLevels();
            if (canManage) void refetchRoster();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
      </div>

      <aside className="max-w-2xl rounded-2xl border bg-muted/40 p-4 sm:p-5">
        <h2 className="text-base font-semibold tracking-tight">{t("statusTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("statusDescription")}</p>
        <div className="mt-3 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
          <a
            href={ASSESS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("statusAssessLink")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          <a
            href={CHART_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("statusChartLink")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </aside>

      <img
        src="/img/under-construction.webp"
        alt={t("comingSoon")}
        className="w-full max-w-xl rounded-xl"
      />

      <AlertDialog
        open={setupIncomplete}
        onOpenChange={() => {
          /* Non-dismissable while setup is incomplete. */
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("setupTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("setupDescription")} {t("setupProgress", { set: setCount, total })}
            </AlertDialogDescription>
            <Badge variant="secondary" className="w-fit tabular-nums">
              {t("setupProgressChip", { set: setCount, total })}
            </Badge>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                void navigate({
                  to: "/class/$classId/raz/initial-levels",
                  params: { classId },
                });
              }}
            >
              {t("setupAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
