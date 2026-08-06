import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  createActivityLogColumns,
  type ActivityLogRow,
} from "@/components/activity/activity-log-columns";
import { ActivityLogDataTable } from "@/components/activity/ActivityLogDataTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassActivity } from "@/hooks/activity/useClassActivity";
import { useExportClassActivityCsv } from "@/hooks/activity/useExportClassActivityCsv";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";

export function ActivityLogPage({ classId }: { classId: Id<"classes"> }) {
  const { t } = useTranslation("classes");
  const { results, status, loadMore, isPending } = useClassActivity(classId);
  const exportCsv = useExportClassActivityCsv(classId);
  const columns = useMemo(() => createActivityLogColumns(t), [t]);

  // Load all pages so client-side sort/filter covers the full log.
  useEffect(() => {
    if (status === "CanLoadMore") {
      loadMore(100);
    }
  }, [status, loadMore]);

  const accessArgs = useMemo(
    () => ({
      classId,
      resourceType: "activity",
      summary: "Viewed activity log",
    }),
    [classId],
  );
  useLogClassAccessOnce(!isPending, accessArgs);

  const rows = results as ActivityLogRow[];
  const isLoadingMore = status === "LoadingMore" || status === "CanLoadMore";
  const showTable = !isPending;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("navActivityLog")}</h1>
          <p className="text-sm text-muted-foreground">{t("activityDescription")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || isLoadingMore || exportCsv.isPending || rows.length === 0}
          onClick={() => {
            exportCsv.mutate();
          }}
        >
          {exportCsv.isPending ? t("activityExporting") : t("activityExportCsv")}
        </Button>
      </div>

      {isPending ? <Skeleton className="h-72 w-full" /> : null}

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
