import { Target, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonalStudentPicker } from "@/components/personal/PersonalStudentPicker";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExpectationsForAudience } from "@/hooks/expectations/useExpectationsForAudience";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import {
  formatExpectationValue,
  valuesByExpectationAndStudent,
} from "@/lib/expectations/expectations";
import { ONE_HOUR } from "@/lib/queryCache";
import { getRosterDisplayName, resolveRosterNameFormat } from "@/lib/roster/roster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type PersonalExpectationsPageProps = {
  classId: Id<"classes">;
};

export function PersonalExpectationsPage({ classId }: PersonalExpectationsPageProps) {
  const { t } = useTranslation("expectations");
  const { t: tClasses } = useTranslation("classes");
  const { data: classDoc } = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
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
  const expectations = data?.expectations ?? [];
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

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("personalTitle")}</h1>
        <p className="hidden text-muted-foreground sm:block">{t("personalDescription")}</p>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
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
        <Empty className="border border-dashed">
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

          {expectations.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescriptionReader")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-2xl ring-1 ring-foreground/10">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[65%]">{t("nameLabel")}</TableHead>
                    <TableHead className="w-[35%]">{t("valueLabel")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expectations.map((expectation) => {
                    const value = activeStudentId
                      ? valueMap.get(`${expectation._id}:${activeStudentId}`)
                      : undefined;
                    return (
                      <TableRow key={expectation._id}>
                        <TableCell className="max-w-0 align-top whitespace-normal wrap-break-word">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-medium">{expectation.name}</span>
                            {expectation.description?.trim() ? (
                              <span className="text-xs text-muted-foreground">
                                {expectation.description}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal tabular-nums wrap-break-word">
                          {formatExpectationValue(expectation, value, t("rosterUnset"))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t("personalReadOnlyHint")}</p>
        </>
      ) : null}
    </div>
  );
}
