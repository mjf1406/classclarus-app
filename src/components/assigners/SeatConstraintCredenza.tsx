import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeatLayoutZoneNames } from "@/hooks/assigners/useSeatLayoutZoneNames";
import {
  isPairConstraintType,
  type SeatConstraintFormValues,
  type SeatConstraintPolarity,
  type SeatConstraintType,
} from "@/lib/assigners/seatConstraints";
import {
  getRosterDisplayName,
  type RosterNameFormat,
  type StudentRosterEntry,
} from "@/lib/roster/roster";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatConstraintCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  roster: StudentRosterEntry[] | undefined;
  rosterPending: boolean;
  nameFormat: RosterNameFormat;
  title: string;
  description: string;
  initial?: SeatConstraintFormValues;
  onSubmit: (values: SeatConstraintFormValues) => Promise<void>;
};

export function SeatConstraintCredenza({
  open,
  onOpenChange,
  classId,
  roster,
  rosterPending,
  nameFormat,
  title,
  description,
  initial,
  onSubmit,
}: SeatConstraintCredenzaProps) {
  const { t } = useTranslation("assigners");
  const { t: tClasses } = useTranslation("classes");
  const { data: zoneNames, isPending: zonesPending } = useSeatLayoutZoneNames(classId);

  const [type, setType] = useState<SeatConstraintType>("neighbor");
  const [polarity, setPolarity] = useState<SeatConstraintPolarity>("must");
  const [studentUserId, setStudentUserId] = useState("");
  const [otherStudentUserId, setOtherStudentUserId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unnamed = tClasses("unnamedMember");

  const studentOptions = useMemo(() => {
    if (!roster) return [];
    return roster.map((student) => ({
      value: student.userId,
      label: getRosterDisplayName(student, unnamed, nameFormat),
    }));
  }, [nameFormat, roster, unnamed]);

  const availableZones = useMemo(() => {
    const names = zoneNames ?? [];
    if (initial?.zoneName && !names.includes(initial.zoneName)) {
      return [...names, initial.zoneName].sort((a, b) => a.localeCompare(b));
    }
    return names;
  }, [initial?.zoneName, zoneNames]);
  const pairType = isPairConstraintType(type);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "neighbor");
    setPolarity(initial?.polarity ?? "must");
    setStudentUserId(initial?.studentUserId ?? "");
    setOtherStudentUserId(initial?.otherStudentUserId ?? "");
    setZoneName(initial?.zoneName ?? "");
    setError(null);
    setIsSubmitting(false);
  }, [open, initial]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!studentUserId) {
      setError(t("constraintStudentRequired"));
      return;
    }

    if (pairType) {
      if (!otherStudentUserId) {
        setError(t("constraintOtherStudentRequired"));
        return;
      }
      if (otherStudentUserId === studentUserId) {
        setError(t("constraintStudentsMustDiffer"));
        return;
      }
    } else {
      if (availableZones.length === 0) {
        setError(t("constraintNoZones"));
        return;
      }
      if (!zoneName) {
        setError(t("constraintZoneRequired"));
        return;
      }
    }

    const values: SeatConstraintFormValues = pairType
      ? {
          type,
          polarity,
          studentUserId: studentUserId as Id<"users">,
          otherStudentUserId: otherStudentUserId as Id<"users">,
        }
      : {
          type: "zone",
          polarity,
          studentUserId: studentUserId as Id<"users">,
          zoneName,
        };

    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onSubmit(values);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  const studentLabel = (userId: string) =>
    studentOptions.find((option) => option.value === userId)?.label ?? null;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{description}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{t("constraintTypeLabel")}</FieldLabel>
              <Select
                value={type}
                onValueChange={(next) => {
                  if (next === "neighbor" || next === "teammate" || next === "zone") {
                    setType(next);
                    setError(null);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {type === "neighbor"
                      ? t("constraintTypeNeighbor")
                      : type === "teammate"
                        ? t("constraintTypeTeammate")
                        : t("constraintTypeZone")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="neighbor">{t("constraintTypeNeighbor")}</SelectItem>
                    <SelectItem value="teammate">{t("constraintTypeTeammate")}</SelectItem>
                    <SelectItem
                      value="zone"
                      disabled={availableZones.length === 0 && !zonesPending}
                    >
                      {t("constraintTypeZone")}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {type === "zone" && !zonesPending && availableZones.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("constraintNoZones")}</p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel>{t("constraintPolarityLabel")}</FieldLabel>
              <Select
                value={polarity}
                onValueChange={(next) => {
                  if (next === "must" || next === "mustNot") {
                    setPolarity(next);
                    setError(null);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {polarity === "must"
                      ? t("constraintPolarityMust")
                      : t("constraintPolarityMustNot")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="must">{t("constraintPolarityMust")}</SelectItem>
                    <SelectItem value="mustNot">{t("constraintPolarityMustNot")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={error && !studentUserId ? true : undefined}>
              <FieldLabel>{t("constraintStudentLabel")}</FieldLabel>
              {rosterPending ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={studentUserId || null}
                  onValueChange={(next) => {
                    if (next) {
                      setStudentUserId(next);
                      setError(null);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("constraintStudentPlaceholder")}>
                      {studentLabel(studentUserId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {studentOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </Field>

            {pairType ? (
              <Field data-invalid={error && !otherStudentUserId ? true : undefined}>
                <FieldLabel>{t("constraintOtherStudentLabel")}</FieldLabel>
                {rosterPending ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={otherStudentUserId || null}
                    onValueChange={(next) => {
                      if (next) {
                        setOtherStudentUserId(next);
                        setError(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("constraintOtherStudentPlaceholder")}>
                        {studentLabel(otherStudentUserId)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {studentOptions
                          .filter((option) => option.value !== studentUserId)
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            ) : (
              <Field data-invalid={error && !zoneName ? true : undefined}>
                <FieldLabel>{t("constraintZoneLabel")}</FieldLabel>
                {zonesPending ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={zoneName || null}
                    onValueChange={(next) => {
                      if (next) {
                        setZoneName(next);
                        setError(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("constraintZonePlaceholder")}>
                        {zoneName || null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableZones.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting || rosterPending || (type === "zone" && zonesPending)}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
