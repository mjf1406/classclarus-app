import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
import { isClassArchived, sortClasses } from "@/lib/classes/classes";
import type { Id } from "../../../convex/_generated/dataModel";

type ImportSeatAlgorithmSettingsCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetClassId: Id<"classes">;
  onSubmit: (sourceClassId: Id<"classes">) => Promise<void>;
};

export function ImportSeatAlgorithmSettingsCredenza({
  open,
  onOpenChange,
  targetClassId,
  onSubmit,
}: ImportSeatAlgorithmSettingsCredenzaProps) {
  const { t, i18n } = useTranslation("assigners");
  const { data: classes, isPending } = useActiveClasses();
  const [sourceClassId, setSourceClassId] = useState<Id<"classes"> | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const options = useMemo(() => {
    const list = (classes ?? []).filter(
      (classDoc) => classDoc._id !== targetClassId && !isClassArchived(classDoc),
    );
    return sortClasses(list, i18n.language);
  }, [classes, i18n.language, targetClassId]);

  useEffect(() => {
    if (!open) return;
    setIsSubmitting(false);
    setSubmitError(null);
    setSourceClassId("");
  }, [open]);

  const handleConfirm = async () => {
    if (!sourceClassId || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    onOpenChange(false);
    try {
      await onSubmit(sourceClassId);
    } catch (error) {
      onOpenChange(true);
      setIsSubmitting(false);
      setSubmitError(error instanceof Error ? error.message : t("settingsImportFailed"));
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("settingsImportTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("settingsImportDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <Field>
          <FieldLabel>{t("settingsImportSourceLabel")}</FieldLabel>
          <Select
            value={sourceClassId || undefined}
            onValueChange={(value) => {
              setSourceClassId(value as Id<"classes">);
              setSubmitError(null);
            }}
            disabled={isPending || options.length === 0 || isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("settingsImportSourcePlaceholder")} />
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
          {options.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("settingsImportNoSources")}</p>
          ) : null}
          {submitError ? <p className="mt-2 text-sm text-destructive">{submitError}</p> : null}
        </Field>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("cancel")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={!sourceClassId || isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {t("settingsImportAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
