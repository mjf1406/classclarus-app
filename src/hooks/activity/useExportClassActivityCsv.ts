import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { CLASS_ACTIVITY_PAGE_SIZE } from "@/hooks/activity/useClassActivity";
import { buildActivityCsv, downloadTextFile } from "@/lib/activity/csv";
import { formatActivitySummary } from "@/lib/activity/formatActivitySummary";
import { messageFromError } from "@/lib/errors/convexError";

type ExportClassActivityCsvArgs = {
  /** Known row count from the loaded table (for progress %). */
  expectedTotal?: number;
};

type ActivityListEvent = {
  createdAt: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  summary: string;
  summaryKey?: string;
  metadata?: Record<string, string>;
};

/**
 * Fetch all activity pages and download as CSV.
 * Exposes 0–100 `progress` for ProgressButton; no success toast (download is obvious).
 */
export function useExportClassActivityCsv(classId: Id<"classes">) {
  const convex = useConvex();
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const logAccess = useLogClassAccess();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (args?: ExportClassActivityCsvArgs) => {
      const expectedTotal = args?.expectedTotal;
      const rows: Array<{
        createdAt: number;
        actorEmail: string;
        actorRole: string;
        action: string;
        resourceType: string;
        resourceId?: string;
        summary: string;
      }> = [];
      let cursor: string | null = null;
      let isDone = false;
      let pagesFetched = 0;

      setProgress(0);

      while (!isDone) {
        const page: {
          page: ActivityListEvent[];
          isDone: boolean;
          continueCursor: string;
        } = await convex.query(api.activity.list, {
          classId,
          paginationOpts: {
            numItems: CLASS_ACTIVITY_PAGE_SIZE,
            cursor,
          },
        });
        for (const event of page.page) {
          rows.push({
            createdAt: event.createdAt,
            actorEmail: event.actorEmail,
            actorRole: event.actorRole,
            action: event.action,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            summary: formatActivitySummary(event, t),
          });
        }
        isDone = page.isDone;
        cursor = page.continueCursor;
        pagesFetched += 1;

        if (expectedTotal != null && expectedTotal > 0) {
          setProgress(Math.min(99, Math.round((rows.length / expectedTotal) * 100)));
        } else {
          setProgress(Math.min(95, Math.round(100 * (1 - 1 / (1 + pagesFetched)))));
        }
      }

      const csv = buildActivityCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`class-activity-${stamp}.csv`, csv, "text/csv;charset=utf-8");
      setProgress(100);

      logAccess.mutate({
        classId,
        resourceType: "activity",
        summary: "Exported activity log CSV",
        summaryKey: "activitySummary_exportedActivityLogCsv",
        metadata: { rowCount: String(rows.length) },
      });
    },
    retry: false,
    onError: (error) => {
      setProgress(0);
      toast.add({
        type: "error",
        title: messageFromError(error, t("activityExportFailed"), tCommon("rateLimited")),
      });
    },
  });

  return {
    ...mutation,
    progress,
  };
}
