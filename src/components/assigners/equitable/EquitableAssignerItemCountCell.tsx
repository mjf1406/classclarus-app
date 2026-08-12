import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquitableStudentHistory } from "@/hooks/assigners/equitable/useEquitableStudentHistory";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerItemCountCellProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  item: string;
  count: number;
};

export function EquitableAssignerItemCountCell({
  classId,
  assignerId,
  studentUserId,
  item,
  count,
}: EquitableAssignerItemCountCellProps) {
  const { t } = useTranslation("assigners");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-sm tabular-nums",
          "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={t("equitableDataCellToggle", { count, item })}
      >
        <span>{count}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        {open ? (
          <EquitableAssignerItemHistory
            classId={classId}
            assignerId={assignerId}
            studentUserId={studentUserId}
            item={item}
          />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EquitableAssignerItemHistory({
  classId,
  assignerId,
  studentUserId,
  item,
}: {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  item: string;
}) {
  const { t } = useTranslation("assigners");
  const historyQuery = useEquitableStudentHistory(classId, assignerId, studentUserId, { item });
  const historyItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data?.pages],
  );

  if (historyQuery.isPending) {
    return <Skeleton className="mx-auto h-8 w-full max-w-40 rounded-md" />;
  }

  if (historyQuery.isError) {
    return (
      <p className="px-1 text-center text-xs text-destructive">{t("equitableDataHistoryFailed")}</p>
    );
  }

  if (historyItems.length === 0) {
    return (
      <p className="px-1 text-center text-xs text-muted-foreground">
        {t("equitableDataHistoryEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 px-1">
      {historyItems.map((entry) => (
        <li
          key={`${entry.runId}-${entry.ranAt}`}
          className="text-center text-xs text-muted-foreground"
        >
          {formatLocalizedSeatChartHistoryDate(entry.ranAt)}
        </li>
      ))}
      {historyQuery.hasNextPage ? (
        <li>
          <button
            type="button"
            className="w-full text-xs text-primary underline-offset-4 hover:underline"
            disabled={historyQuery.isFetchingNextPage}
            onClick={() => void historyQuery.fetchNextPage()}
          >
            {t("chartHistoryLoadMore")}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
