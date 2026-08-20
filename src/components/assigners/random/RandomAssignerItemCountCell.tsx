import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useRandomStudentHistory } from "@/hooks/assigners/random/useRandomStudentHistory";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

type RandomAssignerItemCountCellProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  studentUserId: Id<"users">;
  item: string;
  count: number;
};

export function RandomAssignerItemCountCell({
  classId,
  assignerId,
  studentUserId,
  item,
  count,
}: RandomAssignerItemCountCellProps) {
  const { t } = useTranslation("assigners");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          "grid w-full grid-cols-[65%_35%] items-center rounded-md text-sm",
          "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={t("randomDataCellToggle", { count, item })}
      >
        <span className="min-w-0 px-3 py-3 text-left whitespace-normal wrap-break-word">
          {item}
        </span>
        <span className="flex items-center justify-end gap-1 px-3 py-3 tabular-nums">
          <span>{count}</span>
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {open ? (
          <RandomAssignerItemHistory
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

function RandomAssignerItemHistory({
  classId,
  assignerId,
  studentUserId,
  item,
}: {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  studentUserId: Id<"users">;
  item: string;
}) {
  const { t } = useTranslation("assigners");
  const historyQuery = useRandomStudentHistory(classId, assignerId, studentUserId, item);
  const historyItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data?.pages],
  );

  if (historyQuery.isPending) {
    return <Skeleton className="h-8 w-full rounded-md" />;
  }

  if (historyQuery.isError) {
    return <p className="text-xs text-destructive">{t("randomDataHistoryFailed")}</p>;
  }

  if (historyItems.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("randomDataHistoryEmpty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {historyItems.map((entry) => (
        <li key={`${entry.runId}-${entry.ranAt}`} className="text-xs text-muted-foreground">
          {formatLocalizedSeatChartHistoryDate(entry.ranAt)}
        </li>
      ))}
      {historyQuery.hasNextPage ? (
        <li>
          <button
            type="button"
            className="text-xs text-primary underline-offset-4 hover:underline"
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
