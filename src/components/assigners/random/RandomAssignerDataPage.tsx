import { SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { RandomAssignerDataStudentCard } from "@/components/assigners/random/RandomAssignerDataStudentCard";
import { RandomAssignerShell } from "@/components/assigners/random/RandomAssignerShell";
import { ErrorState } from "@/components/ui/error-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useRandomAssigner } from "@/hooks/assigners/random/useRandomAssigners";
import { useRandomRosterMatrix } from "@/hooks/assigners/random/useRandomRosterMatrix";
import { useClass } from "@/hooks/classes/useClass";
import { buildRandomAssignerDataRows } from "@/lib/assigners/randomAssignerData";
import { memberMatchesQuery, normalizeSearchText } from "@/lib/members/memberSearch";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../../convex/_generated/dataModel";

const RANDOM_DATA_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";

type RandomAssignerDataPageProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
};

export function RandomAssignerDataPage({ classId, assignerId }: RandomAssignerDataPageProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const [nameQuery, setNameQuery] = useState("");
  const { data: classDoc } = useClass(classId);
  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const { data: assigner } = useRandomAssigner(classId, assignerId);
  const { data: matrix, isPending, isError, refetch } = useRandomRosterMatrix(classId, assignerId);

  useLogClassAccessOnce(
    matrix !== undefined && assigner !== undefined,
    assigner
      ? {
          classId,
          resourceType: "roster",
          resourceId: assignerId,
          summary: `Viewed random assigner data for "${assigner.name}"`,
          summaryKey: "activitySummary_viewedRandomAssignerData",
          metadata: { name: assigner.name },
        }
      : null,
  );

  const countsByStudentId = useMemo(() => {
    const map = new Map<Id<"users">, Map<string, number>>();
    for (const row of matrix?.countsByStudent ?? []) {
      map.set(
        row.studentUserId,
        new Map(row.counts.map((entry) => [entry.item, entry.count] as const)),
      );
    }
    return map;
  }, [matrix?.countsByStudent]);

  const roster = useMemo((): StudentRosterEntry[] => {
    return (matrix?.students ?? []).map((student) => ({
      userId: student.userId,
      rosterNumber: student.rosterNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      name: student.name,
      image: student.image,
      email: student.email,
      role: "student" as const,
    }));
  }, [matrix?.students]);

  const filteredRoster = useMemo(() => {
    const unnamed = tClasses("unnamedMember");
    const normalizedQuery = normalizeSearchText(nameQuery);
    if (!normalizedQuery) return roster;
    return roster.filter((student) =>
      memberMatchesQuery(
        {
          id: student.userId,
          name: getRosterDisplayName(student, unnamed, nameFormat),
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
        },
        normalizedQuery,
      ),
    );
  }, [nameFormat, nameQuery, roster, tClasses]);

  if (isError) {
    return (
      <RandomAssignerShell
        classId={classId}
        assignerId={assignerId}
        tab="data"
        description={t("randomDataDescription")}
      >
        <ErrorState
          title={t("randomLoadFailed")}
          description={t("randomLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </RandomAssignerShell>
    );
  }

  if (isPending || !matrix) {
    return (
      <RandomAssignerShell
        classId={classId}
        assignerId={assignerId}
        tab="data"
        description={t("randomDataDescription")}
      >
        <Skeleton className="h-64 w-full rounded-xl" />
      </RandomAssignerShell>
    );
  }

  return (
    <RandomAssignerShell
      classId={classId}
      assignerId={assignerId}
      tab="data"
      description={t("randomDataDescription", { count: matrix.items.length })}
    >
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("randomDataEmptyStudents")}</p>
      ) : matrix.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("randomDataEmptyItems")}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder={t("constraintNameSearchPlaceholder")}
              aria-label={t("constraintNameSearchLabel")}
              autoComplete="off"
              spellCheck={false}
            />
            {nameQuery ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  variant="ghost"
                  aria-label={tClasses("membersSearchClear")}
                  onClick={() => setNameQuery("")}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {filteredRoster.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tClasses("membersSearchNoResults")}</p>
          ) : (
            <ul className={RANDOM_DATA_GRID_CLASS}>
              {filteredRoster.map((student) => (
                <li key={student.userId}>
                  <RandomAssignerDataStudentCard
                    classId={classId}
                    assignerId={assignerId}
                    student={student}
                    rows={buildRandomAssignerDataRows(
                      matrix.items,
                      countsByStudentId.get(student.userId),
                    )}
                    nameFormat={nameFormat}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </RandomAssignerShell>
  );
}
