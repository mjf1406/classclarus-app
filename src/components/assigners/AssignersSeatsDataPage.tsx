import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AssignersSeatsShell } from "@/components/assigners/AssignersSeatsShell";
import { SeatDataStudentCard } from "@/components/assigners/SeatDataStudentCard";
import { GroupTeamFilterButtons } from "@/components/groups/GroupTeamFilterButtons";
import { ErrorState } from "@/components/ui/error-state";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import {
  useSeatLayoutRosterMatrix,
  type SeatLayoutMatrixDimension,
} from "@/hooks/assigners/useSeatLayoutRosterMatrix";
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import { useSeatLayout } from "@/hooks/assigners/useSeatLayout";
import { useSeatConstraints } from "@/hooks/assigners/useSeatConstraints";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupTeamFilterState } from "@/hooks/groups/useGroupTeamFilterState";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useStudentRosterFilter } from "@/hooks/students/useStudentRosterFilter";
import {
  buildSeatDeskMetadataMap,
  buildSeatHistoryRows,
} from "@/lib/assigners/seating/seatHistoryRows";
import type { SeatConstraint } from "@/lib/assigners/seatConstraints";
import { buildMembershipIndex } from "@/lib/groups/groupTeamFilters";
import {
  getRosterDisplayName,
  resolveRosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

const SEATS_DATA_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";

const DIMENSION_OPTIONS: SeatLayoutMatrixDimension[] = ["seat", "zone", "team", "neighbor"];

type AssignersSeatsDataPageProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsDataPage({ classId }: AssignersSeatsDataPageProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const [nameQuery, setNameQuery] = useState("");
  const [dimension, setDimension] = useState<SeatLayoutMatrixDimension>("seat");
  const [layoutId, setLayoutId] = useState<Id<"seatLayouts"> | undefined>(undefined);

  const { data: classDoc } = useClass(classId);
  const nameFormat = resolveRosterNameFormat(classDoc ?? {});
  const { data: layouts, isPending: layoutsPending } = useSeatLayouts(classId);
  const sortedLayouts = useMemo(
    () =>
      [...(layouts ?? [])].sort(
        (a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name),
      ),
    [layouts],
  );
  const selectedLayout = sortedLayouts.find((layout) => layout._id === layoutId);

  useEffect(() => {
    if (layoutId !== undefined) return;
    const firstLayout = sortedLayouts[0];
    if (firstLayout) {
      setLayoutId(firstLayout._id);
    }
  }, [layoutId, sortedLayouts]);

  const {
    data: matrix,
    isPending: matrixPending,
    isError,
    refetch,
  } = useSeatLayoutRosterMatrix(classId, layoutId, dimension);
  const { data: layoutDetail } = useSeatLayout(classId, layoutId);
  const { data: constraints } = useSeatConstraints(classId);
  const { data: board, isPending: boardPending } = useGroupsBoard(classId);
  const groupTeamFilterState = useGroupTeamFilterState(classId);

  useLogClassAccessOnce(
    matrix !== undefined && selectedLayout !== undefined,
    selectedLayout
      ? {
          classId,
          resourceType: "roster",
          resourceId: selectedLayout._id,
          summary: `Viewed seat layout data for "${selectedLayout.name}"`,
          summaryKey: "activitySummary_viewedSeatLayoutData",
          metadata: { name: selectedLayout.name },
        }
      : null,
  );

  const countsByStudentId = useMemo(() => {
    const map = new Map<Id<"users">, Map<string, number>>();
    for (const row of matrix?.countsByStudent ?? []) {
      map.set(
        row.studentUserId,
        new Map(row.counts.map((entry) => [entry.key, entry.count] as const)),
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
      gender: student.gender,
      genderSelfDescribe: student.genderSelfDescribe,
      pronouns: student.pronouns,
      pronounsSelfDescribe: student.pronounsSelfDescribe,
      role: "student" as const,
    }));
  }, [matrix?.students]);

  const membershipByUserId = useMemo(() => (board ? buildMembershipIndex(board) : {}), [board]);
  const filterState = useMemo(
    () => ({
      groupIds: groupTeamFilterState.groupIds,
      teamIds: groupTeamFilterState.teamIds,
      includeUngrouped: groupTeamFilterState.includeUngrouped,
    }),
    [
      groupTeamFilterState.groupIds,
      groupTeamFilterState.includeUngrouped,
      groupTeamFilterState.teamIds,
    ],
  );
  const { filtered: filteredRoster } = useStudentRosterFilter({
    members: roster,
    query: nameQuery,
    membershipByUserId,
    filterState,
  });

  const seatMetadataByKey = useMemo(() => {
    if (dimension !== "seat" || !layoutId || !layoutDetail) return undefined;
    return buildSeatDeskMetadataMap(layoutId, layoutDetail.items, board?.groups ?? []);
  }, [board?.groups, dimension, layoutDetail, layoutId]);

  const constraintsByStudentId = useMemo(() => {
    const map = new Map<Id<"users">, SeatConstraint[]>();
    for (const constraint of constraints ?? []) {
      const existing = map.get(constraint.studentUserId) ?? [];
      existing.push(constraint);
      map.set(constraint.studentUserId, existing);
    }
    return map;
  }, [constraints]);

  const studentNameById = useMemo(() => {
    const map = new Map<Id<"users">, string>();
    const unnamed = tClasses("unnamedMember");
    for (const student of roster) {
      map.set(student.userId, getRosterDisplayName(student, unnamed, nameFormat));
    }
    return map;
  }, [nameFormat, roster, tClasses]);

  const dimensionLabel = (value: SeatLayoutMatrixDimension) => {
    switch (value) {
      case "seat":
        return t("seatsDataDimensionSeat");
      case "zone":
        return t("seatsDataDimensionZone");
      case "team":
        return t("seatsDataDimensionTeam");
      case "neighbor":
        return t("seatsDataDimensionNeighbor");
    }
  };

  const description =
    selectedLayout && matrix
      ? t("seatsDataDescription", {
          layoutName: selectedLayout.name,
          dimension: dimensionLabel(dimension),
        })
      : t("seatsDataDescriptionFallback");

  if (isError) {
    return (
      <AssignersSeatsShell classId={classId} tab="data" description={description}>
        <ErrorState
          title={t("seatsDataLoadFailed")}
          description={t("seatsDataLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </AssignersSeatsShell>
    );
  }

  if (layoutsPending || boardPending) {
    return (
      <AssignersSeatsShell classId={classId} tab="data" description={description}>
        <Skeleton className="h-64 w-full rounded-xl" />
      </AssignersSeatsShell>
    );
  }

  if (sortedLayouts.length === 0) {
    return (
      <AssignersSeatsShell classId={classId} tab="data" description={description}>
        <p className="text-sm text-muted-foreground">{t("seatsDataNoLayouts")}</p>
      </AssignersSeatsShell>
    );
  }

  return (
    <AssignersSeatsShell classId={classId} tab="data" description={description}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field className="min-w-48 max-w-sm flex-1">
            <FieldLabel htmlFor="seats-data-layout">{t("seatsDataSelectLayout")}</FieldLabel>
            <Select
              value={layoutId}
              onValueChange={(value) => {
                if (!value) return;
                setLayoutId(value as Id<"seatLayouts">);
              }}
            >
              <SelectTrigger id="seats-data-layout" className="w-full">
                <SelectValue placeholder={t("seatsDataSelectLayoutPlaceholder")}>
                  {selectedLayout?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortedLayouts.map((layout) => (
                    <SelectItem key={layout._id} value={layout._id}>
                      {layout.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[dimension]}
            onValueChange={(values) => {
              const next = values[0];
              if (next === "seat" || next === "zone" || next === "team" || next === "neighbor") {
                setDimension(next);
              }
            }}
          >
            {DIMENSION_OPTIONS.map((option) => (
              <ToggleGroupItem key={option} value={option} aria-label={dimensionLabel(option)}>
                {dimensionLabel(option)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {matrixPending || !matrix ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("seatsDataEmptyStudents")}</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <GroupTeamFilterButtons classId={classId} />

            <div className="flex flex-wrap items-center gap-3">
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
            </div>

            {filteredRoster.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tClasses("membersSearchNoResults")}</p>
            ) : (
              <ul className={SEATS_DATA_GRID_CLASS}>
                {filteredRoster.map((student) => (
                  <li key={student.userId}>
                    <SeatDataStudentCard
                      classId={classId}
                      layoutId={matrix.layout._id}
                      dimension={dimension}
                      student={student}
                      rows={buildSeatHistoryRows(
                        matrix.values,
                        countsByStudentId.get(student.userId),
                        seatMetadataByKey,
                      )}
                      constraints={constraintsByStudentId.get(student.userId) ?? []}
                      studentNameById={studentNameById}
                      nameFormat={nameFormat}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </AssignersSeatsShell>
  );
}
