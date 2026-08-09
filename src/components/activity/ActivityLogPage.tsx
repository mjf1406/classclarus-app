import { useEffect, useMemo } from "react";
import { FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  createActivityLogColumns,
  type ActivityLogRow,
} from "@/components/activity/activity-log-columns";
import { ActivityLogDataTable } from "@/components/activity/ActivityLogDataTable";
import { ProgressButton } from "@/components/ui/progress-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useClassActivity } from "@/hooks/activity/useClassActivity";
import { useExportClassActivityCsv } from "@/hooks/activity/useExportClassActivityCsv";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";

export function ActivityLogPage({ classId }: { classId: Id<"classes"> }) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const { results, status, fetchNextPage, isPending, isLoadingMore, isRefreshing } =
    useClassActivity(classId);
  const exportCsv = useExportClassActivityCsv(classId);
  const columns = useMemo(() => createActivityLogColumns(t), [t]);

  // Load all pages so client-side sort/filter covers the full log.
  useEffect(() => {
    if (status === "CanLoadMore") {
      void fetchNextPage();
    }
  }, [status, fetchNextPage]);

  const accessArgs = useMemo(
    () => ({
      classId,
      resourceType: "activity",
      summary: "Viewed activity log",
      summaryKey: "activitySummary_viewedActivityLog",
    }),
    [classId],
  );
  useLogClassAccessOnce(!isPending, accessArgs);

  const rows = results as ActivityLogRow[];
  const showTable = !isPending;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("navActivityLog")}
          </h1>
          <p className="hidden text-muted-foreground sm:block">{t("activityDescription")}</p>
        </div>
        <ProgressButton
          type="button"
          variant="outline"
          pending={exportCsv.isPending}
          progress={exportCsv.progress}
          disabled={isPending || isLoadingMore || rows.length === 0}
          onClick={() => {
            void exportCsv.mutateAsync({ expectedTotal: rows.length });
          }}
        >
          <FileDown data-icon="inline-start" />
          {t("activityExportCsv")}
        </ProgressButton>
      </div>

      {isPending ? <Skeleton className="h-72 w-full" /> : null}

      {isRefreshing || (showTable && isLoadingMore) ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" aria-label={tCommon("loading")} />
          {tCommon("loading")}
        </p>
      ) : null}

      {showTable ? (
        <ActivityLogDataTable
          columns={columns}
          data={rows}
          emptyLabel={
            rows.length === 0 ? t("activityEmptyDescription") : t("activityFilterNoResults")
          }
        />
      ) : null}
    </div>
  );
}
