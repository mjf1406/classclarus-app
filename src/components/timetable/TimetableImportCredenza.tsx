import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Credenza,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveClasses } from "@/hooks/classes/useClasses";
import { useTimetableTerms } from "@/hooks/timetable/useTimetableQueries";
import { isClassArchived, sortClasses } from "@/lib/classes/classes";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableImportCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetClassId: Id<"classes">;
  onSubmit: (input: {
    sourceClassId: Id<"classes">;
    sourceTermId?: Id<"timetableTerms">;
    importSubjects: boolean;
    importSlots: boolean;
  }) => Promise<void>;
};

export function TimetableImportCredenza({
  open,
  onOpenChange,
  targetClassId,
  onSubmit,
}: TimetableImportCredenzaProps) {
  const { t, i18n } = useTranslation("timetable");
  const { data: classes, isPending } = useActiveClasses();
  const [sourceClassId, setSourceClassId] = useState<Id<"classes"> | "">("");
  const [sourceTermId, setSourceTermId] = useState<Id<"timetableTerms"> | "">("");
  const [importSubjects, setImportSubjects] = useState(true);
  const [importSlots, setImportSlots] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const options = useMemo(() => {
    const list = (classes ?? []).filter(
      (classDoc) => classDoc._id !== targetClassId && !isClassArchived(classDoc),
    );
    return sortClasses(list, i18n.language);
  }, [classes, i18n.language, targetClassId]);

  const sourceTermsQuery = useTimetableTerms(sourceClassId || undefined);
  const sourceTerms = sourceClassId ? sourceTermsQuery.data : undefined;
  const sourceTermsPending = Boolean(sourceClassId) && sourceTermsQuery.isPending;

  useEffect(() => {
    if (!open) return;
    setIsSubmitting(false);
    setSubmitError(null);
    setSourceClassId("");
    setSourceTermId("");
    setImportSubjects(true);
    setImportSlots(true);
  }, [open]);

  useEffect(() => {
    setSourceTermId("");
  }, [sourceClassId]);

  useEffect(() => {
    if (!sourceClassId || sourceTermId || !sourceTerms?.length) return;
    const first = sourceTerms[0];
    if (first) setSourceTermId(first._id);
  }, [sourceClassId, sourceTermId, sourceTerms]);

  const selected = options.find((classDoc) => classDoc._id === sourceClassId);
  const selectedTerm = sourceTerms?.find((term) => term._id === sourceTermId);
  const canSubmit =
    Boolean(sourceClassId) &&
    (importSubjects || importSlots) &&
    (!importSlots || Boolean(sourceTermId)) &&
    !isSubmitting &&
    options.length > 0;

  const handleConfirm = async () => {
    if (!sourceClassId || isSubmitting) return;
    if (!importSubjects && !importSlots) {
      setSubmitError(t("importNothingSelected"));
      return;
    }
    if (importSlots && !sourceTermId) {
      setSubmitError(t("importNoTerms"));
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    onOpenChange(false);
    try {
      await onSubmit({
        sourceClassId,
        sourceTermId: importSlots && sourceTermId ? sourceTermId : undefined,
        importSubjects,
        importSlots,
      });
    } catch (error) {
      onOpenChange(true);
      setIsSubmitting(false);
      setSubmitError(error instanceof Error ? error.message : t("importFailed"));
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("importTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("importDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <div className="flex flex-col gap-4 px-4 pb-2 sm:px-6">
          <Field>
            <FieldLabel>{t("importSourceLabel")}</FieldLabel>
            <Select
              value={sourceClassId || undefined}
              onValueChange={(next) => {
                if (next == null) return;
                setSourceClassId(next as Id<"classes">);
              }}
              disabled={isPending || options.length === 0}
            >
              <SelectTrigger className="w-full" aria-label={t("importSourceLabel")}>
                <SelectValue placeholder={t("importSourcePlaceholder")}>
                  {selected?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((classDoc) => (
                    <SelectItem key={classDoc._id} value={classDoc._id}>
                      {classDoc.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={importSubjects}
              onCheckedChange={(checked) => setImportSubjects(checked === true)}
            />
            {t("importSubjects")}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={importSlots}
              onCheckedChange={(checked) => setImportSlots(checked === true)}
            />
            {t("importSlots")}
          </label>

          {importSlots ? (
            <Field>
              <FieldLabel>{t("importSourceTerm")}</FieldLabel>
              <Select
                value={sourceTermId || undefined}
                onValueChange={(next) => {
                  if (next == null) return;
                  setSourceTermId(next as Id<"timetableTerms">);
                }}
                disabled={!sourceClassId || sourceTermsPending || (sourceTerms?.length ?? 0) === 0}
              >
                <SelectTrigger className="w-full" aria-label={t("importSourceTerm")}>
                  <SelectValue placeholder={t("importSourceTermPlaceholder")}>
                    {selectedTerm?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(sourceTerms ?? []).map((term) => (
                      <SelectItem key={term._id} value={term._id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {sourceClassId && sourceTermsQuery.isError ? (
                <p className="text-sm text-destructive">{t("importFailed")}</p>
              ) : null}
              {sourceClassId &&
              !sourceTermsPending &&
              !sourceTermsQuery.isError &&
              (sourceTerms?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t("importNoTerms")}</p>
              ) : null}
            </Field>
          ) : null}

          {options.length === 0 && !isPending ? (
            <p className="text-sm text-muted-foreground">{t("importNoSources")}</p>
          ) : null}
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        </div>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t("importAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
