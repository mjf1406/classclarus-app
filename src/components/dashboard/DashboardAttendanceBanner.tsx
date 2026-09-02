import { ClipboardCheck } from "lucide-react";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceForDate } from "@/hooks/attendance/useAttendanceForDate";
import { localDateKey } from "@/lib/attendance/dateKey";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type DashboardAttendanceBannerProps = {
  classId: Id<"classes">;
};

export function DashboardAttendanceBanner({ classId }: DashboardAttendanceBannerProps) {
  const { t } = useTranslation("classes");
  const dateKey = useMemo(() => localDateKey(), []);
  const query = useAttendanceForDate(classId, dateKey);

  if (query.isPending) {
    return <Skeleton className="h-16 w-full rounded-2xl" />;
  }
  if (query.isError) {
    return null;
  }

  const session = query.data?.session ?? null;
  const records = query.data?.records ?? [];

  if (!session) {
    return (
      <Alert variant="warning">
        <ClipboardCheck />
        <AlertTitle>{t("dashboardAttendanceNotTaken")}</AlertTitle>
        <AlertDescription>{t("dashboardAttendanceNotTakenDescription")}</AlertDescription>
        <AlertAction>
          <Link
            to="/class/$classId/attendance"
            params={{ classId }}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {t("dashboardTakeAttendance")}
          </Link>
        </AlertAction>
      </Alert>
    );
  }

  const present = records.filter((record) => record.status === "present").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const late = records.filter((record) => record.status === "late").length;

  return (
    <Alert>
      <ClipboardCheck />
      <AlertTitle>{t("dashboardAttendanceTakenTitle")}</AlertTitle>
      <AlertDescription>
        {t("dashboardAttendanceTaken", { present, absent, late })}
      </AlertDescription>
      <AlertAction>
        <Link
          to="/class/$classId/attendance"
          params={{ classId }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t("dashboardViewAll")}
        </Link>
      </AlertAction>
    </Alert>
  );
}
