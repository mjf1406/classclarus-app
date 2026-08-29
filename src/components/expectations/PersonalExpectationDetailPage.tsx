import { Link } from "@tanstack/react-router";
import { ArrowLeft, Target, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpectationsForAudience } from "@/hooks/expectations/useExpectationsForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import {
  formatExpectationValue,
  valuesByExpectationAndStudent,
} from "@/lib/expectations/expectations";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

type PersonalExpectationDetailPageProps = {
  classId: Id<"classes">;
  expectationId: Id<"expectations">;
};

export function PersonalExpectationDetailPage({
  classId,
  expectationId,
}: PersonalExpectationDetailPageProps) {
  const { t } = useTranslation("expectations");
  const { t: tClasses } = useTranslation("classes");
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const { data, isPending, isError, refetch } = useExpectationsForAudience(classId);

  const nameFormat = useMemo(
    () =>
      resolveRosterNameFormat({
        rosterNameOrder: classDoc?.rosterNameOrder,
        rosterNameSpace: classDoc?.rosterNameSpace,
      }),
    [classDoc?.rosterNameOrder, classDoc?.rosterNameSpace],
  );

  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const expectation = data?.expectations.find((item) => item._id === expectationId);
  const valueMap = useMemo(() => valuesByExpectationAndStudent(data?.values), [data?.values]);

  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const activeStudentId = selectedUserId ?? students[0]?.userId ?? null;

  useEffect(() => {
    if (students.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (selectedUserId && students.some((student) => student.userId === selectedUserId)) {
      return;
    }
    setSelectedUserId(students[0]!.userId);
  }, [selectedUserId, students]);

  const activeStudent = students.find((student) => student.userId === activeStudentId);
  const activeName = activeStudent
    ? getRosterDisplayName(activeStudent, tClasses("unnamedMember"), nameFormat)
    : null;
  const value =
    expectation && activeStudentId
      ? valueMap.get(`${expectation._id}:${activeStudentId}`)
      : undefined;

  if (isPending) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!expectation) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          render={<Link to="/class/$classId/expectations" params={{ classId }} />}
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Button>
        <ErrorState title={t("notFoundTitle")} description={t("notFoundDescription")} />
      </div>
    );
  }

  const inputTypeLabel =
    expectation.inputType === "numberRange" ? t("inputTypeNumberRange") : t("inputTypeNumber");

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        render={<Link to="/class/$classId/expectations" params={{ classId }} />}
      >
        <ArrowLeft className="size-4" />
        {t("backToList")}
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{expectation.name}</h1>
        <p className="text-muted-foreground">
          {expectation.description?.trim() || t("emptyDescriptionPreview")}
        </p>
        <p className="text-sm text-muted-foreground">
          {inputTypeLabel} · {expectation.unit}
        </p>
      </div>

      {students.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("personalStudentsEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("personalStudentsEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {activeStudentId ? (
            <PersonalStudentPicker
              students={students}
              selectedUserId={activeStudentId}
              nameFormat={nameFormat}
              onSelect={setSelectedUserId}
            />
          ) : null}

          {activeName ? (
            <p className="text-sm text-muted-foreground">
              {t("personalStudentLabel", { name: activeName })}
            </p>
          ) : null}

          <div className="rounded-2xl border px-4 py-6">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">{t("valueLabel")}</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {formatExpectationValue(expectation, value, t("rosterUnset"))}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t("personalReadOnlyHint")}</p>
        </>
      )}
    </div>
  );
}
