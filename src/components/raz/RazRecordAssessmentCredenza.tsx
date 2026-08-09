import { InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Id } from "../../../convex/_generated/dataModel";
import { parseDueDateKey } from "@/lib/dueDate/dueDateKey";
import { isRazLevel, RAZ_LEVEL_KEYS } from "@/lib/raz/levels";
import { getScoreRecommendation, type RazAssessmentResult } from "@/lib/raz/scoreRecommendation";

const RESULTS: RazAssessmentResult[] = ["level_up", "stay", "level_down"];

function localDateTimeInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export type RazRecordAssessmentStudent = {
  userId: Id<"users">;
  displayName: string;
  rosterNumber?: number | null;
  currentLevel: string;
};

type RazRecordAssessmentCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: RazRecordAssessmentStudent | null;
  onSubmit: (args: {
    studentUserId: Id<"users">;
    assessedAt: number;
    readAccuracy: number;
    retellScore?: number;
    respondScore: number;
    result: RazAssessmentResult;
    level: string;
    note?: string;
  }) => Promise<void>;
};

export function RazRecordAssessmentCredenza({
  open,
  onOpenChange,
  student,
  onSubmit,
}: RazRecordAssessmentCredenzaProps) {
  const { t } = useTranslation("raz");
  const { t: tCommon } = useTranslation("common");

  const [assessedAtLocal, setAssessedAtLocal] = useState(localDateTimeInputValue);
  const [readAccuracy, setReadAccuracy] = useState(100);
  const [retellScore, setRetellScore] = useState<number | null>(null);
  const [respondScore, setRespondScore] = useState<number | null>(null);
  const [result, setResult] = useState<RazAssessmentResult | "">("");
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const studentUserId = student?.userId;
  const studentCurrentLevel = student?.currentLevel;

  useEffect(() => {
    if (!open || studentUserId == null || studentCurrentLevel == null) return;
    setAssessedAtLocal(localDateTimeInputValue());
    setReadAccuracy(100);
    setRetellScore(null);
    setRespondScore(null);
    setResult("");
    setLevel(studentCurrentLevel);
    setNote("");
    setError(null);
    setSubmitError(null);
  }, [open, studentUserId, studentCurrentLevel]);

  useEffect(() => {
    if (!open || !student || respondScore === null) return;
    const rec = getScoreRecommendation(readAccuracy, respondScore, student.currentLevel);
    setResult(rec.result);
    setLevel(rec.level);
  }, [open, student, readAccuracy, respondScore]);

  if (!student) return null;

  const recommendation =
    respondScore !== null
      ? getScoreRecommendation(readAccuracy, respondScore, student.currentLevel)
      : null;

  const resultLabel = (value: RazAssessmentResult) => {
    switch (value) {
      case "level_up":
        return t("resultLevelUp");
      case "stay":
        return t("resultStay");
      case "level_down":
        return t("resultLevelDown");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitError(null);

    if (respondScore === null) {
      setError(t("respondRequired"));
      return;
    }
    if (!result || !RESULTS.includes(result)) {
      setError(t("resultRequired"));
      return;
    }
    if (!level || !isRazLevel(level)) {
      setError(t("levelRequired"));
      return;
    }
    const assessedDate = parseDueDateKey(assessedAtLocal);
    if (!assessedDate) {
      setError(t("dateRequired"));
      return;
    }

    const trimmedNote = note.trim();
    onOpenChange(false);
    try {
      await onSubmit({
        studentUserId: student.userId,
        assessedAt: assessedDate.getTime(),
        readAccuracy,
        retellScore: retellScore ?? undefined,
        respondScore,
        result,
        level,
        note: trimmedNote.length > 0 ? trimmedNote : undefined,
      });
    } catch (err) {
      onOpenChange(true);
      setSubmitError(err instanceof Error ? err.message : t("assessmentSaveFailed"));
    }
  };

  const rosterLabel = student.rosterNumber != null ? ` (#${student.rosterNumber})` : "";

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex max-h-[min(90dvh,56rem)] w-full flex-col gap-4 overflow-hidden sm:max-w-lg">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{t("recordTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {t("recordFor", { name: `${student.displayName}${rosterLabel}` })}{" "}
            {t("currentLevelLabel", { level: student.currentLevel })}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleSubmit();
          }}
        >
          <CredenzaBody className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="raz-assessed-at">{t("dateLabel")}</FieldLabel>
                <Input
                  id="raz-assessed-at"
                  type="datetime-local"
                  value={assessedAtLocal}
                  onChange={(event) => setAssessedAtLocal(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="raz-read">{t("readLabel")}</FieldLabel>
                <FieldDescription>{t("readDescription")}</FieldDescription>
                <NumberInput
                  id="raz-read"
                  min={0}
                  max={100}
                  value={readAccuracy}
                  onValueChange={setReadAccuracy}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="raz-retell">{t("retellLabel")}</FieldLabel>
                <FieldDescription>{t("retellDescription")}</FieldDescription>
                <NumberInput
                  id="raz-retell"
                  min={0}
                  max={18}
                  value={retellScore}
                  onValueChange={setRetellScore}
                  placeholder={t("retellPlaceholder")}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="raz-respond">{t("respondLabel")}</FieldLabel>
                <FieldDescription>{t("respondDescription")}</FieldDescription>
                <NumberInput
                  id="raz-respond"
                  min={0}
                  max={5}
                  value={respondScore}
                  onValueChange={setRespondScore}
                  placeholder={t("respondPlaceholder")}
                />
              </Field>

              <Alert variant="info">
                <InfoIcon />
                <AlertDescription>
                  {recommendation ? (
                    <Trans
                      i18nKey="recommendMessage"
                      ns="raz"
                      values={{
                        accuracy: recommendation.accuracy,
                        quizPercentage: recommendation.quizPercentage,
                        action: t(recommendation.actionKey),
                      }}
                      components={{ bold: <strong className="font-semibold text-foreground" /> }}
                    />
                  ) : (
                    t("recommendPlaceholder")
                  )}
                </AlertDescription>
              </Alert>

              <Field>
                <FieldLabel htmlFor="raz-note">
                  {t("noteLabel")}{" "}
                  <span className="font-normal text-muted-foreground">({tCommon("optional")})</span>
                </FieldLabel>
                <Textarea
                  id="raz-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("notePlaceholder")}
                  rows={3}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t("resultLabel")}</FieldLabel>
                  <Select
                    value={result || undefined}
                    onValueChange={(next) => {
                      if (!next || !RESULTS.includes(next as RazAssessmentResult)) return;
                      setResult(next as RazAssessmentResult);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={t("resultLabel")}>
                      <SelectValue placeholder={t("resultPlaceholder")}>
                        {result ? resultLabel(result) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RESULTS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {resultLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("levelLabel")}</FieldLabel>
                  <FieldDescription>{t("levelDescription")}</FieldDescription>
                  <Select
                    value={level || undefined}
                    onValueChange={(next) => {
                      if (!next || !isRazLevel(next)) return;
                      setLevel(next);
                    }}
                  >
                    <SelectTrigger className="w-full" aria-label={t("levelLabel")}>
                      <SelectValue placeholder={t("levelPlaceholder")}>{level || null}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RAZ_LEVEL_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {key}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {error ? <FieldError>{error}</FieldError> : null}
              {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 flex-row gap-2 sm:justify-end">
            <CredenzaClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </CredenzaClose>
            <Button type="submit">{t("saveAssessment")}</Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
