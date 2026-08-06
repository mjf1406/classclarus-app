import { useMutation } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { CLASS_ACTIVITY_PAGE_SIZE } from "@/hooks/activity/useClassActivity";
import { buildActivityCsv, downloadTextFile } from "@/lib/activity/csv";
import { messageFromError } from "@/lib/errors/convexError";

/**
 * Fetch all activity pages and download as CSV.
 * Logs the export as an activity read; no success toast (download is obvious).
 */
export function useExportClassActivityCsv(classId: Id<"classes">) {
  const convex = useConvex();
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const logAccess = useLogClassAccess();

  return useMutation({
    mutationFn: async () => {
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

      while (!isDone) {
        const page: {
          page: Array<{
            createdAt: number;
            actorEmail: string;
            actorRole: string;
            action: string;
            resourceType: string;
            resourceId?: string;
            summary: string;
          }>;
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
            summary: event.summary,
          });
        }
        isDone = page.isDone;
        cursor = page.continueCursor;
      }

      const csv = buildActivityCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadTextFile(`class-activity-${stamp}.csv`, csv, "text/csv;charset=utf-8");

      logAccess.mutate({
        classId,
        resourceType: "activity",
        summary: "Exported activity log CSV",
        metadata: { rowCount: String(rows.length) },
      });
    },
    retry: false,
    onError: (error) => {
      toast.add({
        type: "error",
        title: messageFromError(error, t("activityExportFailed"), tCommon("rateLimited")),
      });
    },
  });
}
