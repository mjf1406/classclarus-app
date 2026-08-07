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

type ImportRewardsCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetClassId: Id<"classes">;
  onSubmit: (sourceClassId: Id<"classes">) => Promise<void>;
};

export function ImportRewardsCredenza({
  open,
  onOpenChange,
  targetClassId,
  onSubmit,
}: ImportRewardsCredenzaProps) {
  const { t, i18n } = useTranslation("rewards");
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

  const selected = options.find((classDoc) => classDoc._id === sourceClassId);

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
            disabled={!sourceClassId || isSubmitting || options.length === 0}
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
