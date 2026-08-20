import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquitablePartnerHistory } from "@/hooks/assigners/equitable/useEquitablePartnerHistory";
import { formatLocalizedSeatChartHistoryDate } from "@/i18n/formatDate";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

export type EquitablePartnerCellRow = {
  partnerUserId: Id<"users">;
  count: number;
  firstName?: string;
  lastName?: string;
  name?: string;
};

type EquitableAssignerPartnersCellProps = {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  partners: EquitablePartnerCellRow[];
  rosterById: Map<Id<"users">, StudentRosterEntry>;
  nameFormat: RosterNameFormat;
};

export function EquitableAssignerPartnersCell({
  classId,
  assignerId,
  studentUserId,
  partners,
  rosterById,
  nameFormat,
}: EquitableAssignerPartnersCellProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const unnamed = tClasses("unnamedMember");

  if (partners.length === 0) {
    return (
      <p className="px-1 text-center text-xs text-muted-foreground">
        {t("equitableDataPartnersEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex min-w-40 flex-col gap-0.5">
      {partners.map((partner) => {
        const rosterStudent = rosterById.get(partner.partnerUserId);
        const displayName = getRosterDisplayName(
          rosterStudent ?? {
            userId: partner.partnerUserId,
            firstName: partner.firstName,
            lastName: partner.lastName,
            name: partner.name,
          },
          unnamed,
          nameFormat,
        );
        return (
          <li key={partner.partnerUserId}>
            <EquitableAssignerPartnerRow
              classId={classId}
              assignerId={assignerId}
              studentUserId={studentUserId}
              partner={partner}
              displayName={displayName}
            />
          </li>
        );
      })}
    </ul>
  );
}

function EquitableAssignerPartnerRow({
  classId,
  assignerId,
  studentUserId,
  partner,
  displayName,
}: {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  partner: EquitablePartnerCellRow;
  displayName: string;
}) {
  const { t } = useTranslation("assigners");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-xs",
          "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={t("equitableDataPartnerToggle", { name: displayName, count: partner.count })}
      >
        <span className="min-w-0 truncate">{displayName}</span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
          {partner.count}
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-0.5">
        {open ? (
          <EquitableAssignerPartnerHistory
            classId={classId}
            assignerId={assignerId}
            studentUserId={studentUserId}
            partnerUserId={partner.partnerUserId}
          />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EquitableAssignerPartnerHistory({
  classId,
  assignerId,
  studentUserId,
  partnerUserId,
}: {
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  studentUserId: Id<"users">;
  partnerUserId: Id<"users">;
}) {
  const { t } = useTranslation("assigners");
  const historyQuery = useEquitablePartnerHistory(
    classId,
    assignerId,
    studentUserId,
    partnerUserId,
  );
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
          key={`${entry.runId}-${entry.ranAt}-${entry.item}`}
          className="text-xs text-muted-foreground"
        >
          {t("equitableDataPartnerHistoryItem", {
            date: formatLocalizedSeatChartHistoryDate(entry.ranAt),
            item: entry.item,
          })}
        </li>
      ))}
      {historyQuery.hasNextPage ? (
        <li>
          <button
            type="button"
            className="w-full text-left text-xs text-primary underline-offset-4 hover:underline"
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
