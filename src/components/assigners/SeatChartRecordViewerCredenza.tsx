import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeatChartRecord } from "@/hooks/assigners/useSeatChartRecord";
import type { SeatChartRecord } from "@/lib/assigners/seatCharts";
import {
  resolveTeamLabel,
  seatItemDisplayLabel,
  SEAT_ORIENTATION_DEGREES,
  type SeatOrientation,
} from "@/lib/assigners/seatLayouts";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { formatLocalizedDateTime } from "@/i18n/formatDate";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatChartRecordViewerCredenzaProps = {
  classId: Id<"classes">;
  recordId: Id<"seatChartRecords"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SeatChartRecordViewerCredenza({
  classId,
  recordId,
  open,
  onOpenChange,
}: SeatChartRecordViewerCredenzaProps) {
  const { t } = useTranslation("assigners");
  const { data: record, isPending } = useSeatChartRecord(classId, recordId);
  const { data: board } = useGroupsBoard(classId);
  const orientation: SeatOrientation = "front";

  const itemDefaults = {
    teacherDesk: t("defaultTeacherDeskLabel"),
    board: t("defaultBoardLabel"),
    rect: t("defaultRectLabel"),
  };

  const placementByDesk = useMemo(() => {
    const map = new Map<string, SeatChartRecord["placements"]>();
    for (const placement of record?.placements ?? []) {
      const list = map.get(placement.deskItemId) ?? [];
      list.push(placement);
      map.set(placement.deskItemId, list);
    }
    return map;
  }, [record?.placements]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-4xl">
        <CredenzaHeader>
          <CredenzaTitle>{t("chartRecordViewerTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {record
              ? t("chartRecordViewerDescription", {
                  date: formatLocalizedDateTime(record.recordedAt),
                  chart: record.chartName,
                  layout: record.layoutName,
                })
              : t("chartRecordViewerLoading")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          {isPending || !record ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="overflow-auto rounded-xl border bg-muted/20 p-3">
              <div
                className="relative mx-auto bg-background"
                style={{
                  width: record.canvasWidth,
                  height: record.canvasHeight,
                  transform: `rotate(${SEAT_ORIENTATION_DEGREES[orientation]}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {record.layoutItems.map((item: SeatChartRecord["layoutItems"][number]) => {
                  const placements = placementByDesk.get(item.id) ?? [];
                  const team = item.teamAssignment
                    ? resolveTeamLabel(item.teamAssignment, board?.groups ?? [])
                    : null;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "absolute rounded-md border bg-card text-xs shadow-sm",
                        item.kind === "desk" && "border-primary/40",
                      )}
                      style={{
                        left: item.x,
                        top: item.y,
                        width: item.width,
                        height: item.height,
                      }}
                    >
                      {item.kind === "desk" && item.deskNumber !== undefined ? (
                        <span className="absolute top-0.5 left-1 font-semibold tabular-nums">
                          {item.deskNumber}
                        </span>
                      ) : null}
                      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1 pt-3 text-center">
                        {placements.length > 0 ? (
                          placements.map((placement) => (
                            <span
                              key={placement.studentUserId}
                              className="line-clamp-2 font-medium"
                            >
                              {placement.studentDisplayName}
                            </span>
                          ))
                        ) : (
                          <span className="line-clamp-2 text-muted-foreground">
                            {seatItemDisplayLabel(item, itemDefaults)}
                          </span>
                        )}
                        {team ? (
                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                            {team.label}
                          </span>
                        ) : null}
                        {item.zoneName?.trim() ? (
                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                            {item.zoneName.trim()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CredenzaBody>
      </CredenzaContent>
    </Credenza>
  );
}
