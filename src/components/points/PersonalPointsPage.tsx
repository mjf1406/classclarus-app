import { Coins, UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { PointsLedgerTable } from "@/components/points/PointsLedgerTable";
import { StudentPointsSummaryCard } from "@/components/points/StudentPointsSummaryCard";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePointsForAudience } from "@/hooks/points/usePointsForAudience";
import { usePointsLedgerForAudience } from "@/hooks/points/usePointsLedgerForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import { resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

type PersonalPointsPageProps = {
  classId: Id<"classes">;
};

export function PersonalPointsPage({ classId }: PersonalPointsPageProps) {
  const { t } = useTranslation("points");
  const dateKey = useMemo(() => localDateKey(), []);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const { data, isPending, isError, refetch } = usePointsForAudience(classId, dateKey);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const students = data ?? [];
  const activeStudentId =
    selectedUserId && students.some((student) => student.userId === selectedUserId)
      ? selectedUserId
      : (students[0]?.userId ?? null);

  const ledger = usePointsLedgerForAudience(classId, activeStudentId);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("personalTitle")}</h1>
        <p className="hidden text-muted-foreground sm:block">{t("personalDescription")}</p>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && students.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && students.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <li key={student.userId}>
                <StudentPointsSummaryCard student={student} nameFormat={nameFormat} />
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="size-3.5 shrink-0" aria-hidden />
            {t("personalReadOnlyHint")}
          </p>

          {activeStudentId ? (
            <PersonalStudentPicker
              students={students}
              selectedUserId={activeStudentId}
              nameFormat={nameFormat}
              onSelect={setSelectedUserId}
            />
          ) : null}

          <PointsLedgerTable
            items={ledger.items}
            isPending={ledger.isPending}
            isRefreshing={ledger.isRefreshing}
            isError={ledger.isError}
            onRetry={() => void ledger.refetch()}
            hasNextPage={Boolean(ledger.hasNextPage)}
            isFetchingNextPage={ledger.isFetchingNextPage}
            onLoadMore={async () => {
              await ledger.fetchNextPage();
            }}
            resetKey={activeStudentId}
          />
        </>
      ) : null}
    </div>
  );
}
