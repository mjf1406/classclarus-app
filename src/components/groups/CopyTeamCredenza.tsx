import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { AlsoCreateInGroupOption } from "@/lib/groups/groupFormSchema";
import type { Id } from "../../../convex/_generated/dataModel";

type CopyTeamCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  groupOptions: Array<AlsoCreateInGroupOption>;
  onConfirm: (targetGroupIds: Array<Id<"groups">>) => Promise<void>;
};

export function CopyTeamCredenza({
  open,
  onOpenChange,
  teamName,
  groupOptions,
  onConfirm,
}: CopyTeamCredenzaProps) {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const [selectedIds, setSelectedIds] = useState<Array<Id<"groups">>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chipsAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setIsSubmitting(false);
  }, [open]);

  const selectedValue = useMemo(
    () => groupOptions.filter((option) => selectedIds.includes(option.value)),
    [groupOptions, selectedIds],
  );

  const canSubmit = selectedIds.length > 0 && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    onOpenChange(false);
    try {
      await onConfirm(selectedIds);
    } catch {
      onOpenChange(true);
      setIsSubmitting(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("teamsCopyTitle", { name: teamName })}</CredenzaTitle>
          <CredenzaDescription>{t("teamsCopyDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <Field>
            <FieldLabel>{t("teamsCopyToLabel")}</FieldLabel>
            <FieldDescription>{t("teamsCopyToHint")}</FieldDescription>
            <Combobox
              multiple
              items={groupOptions}
              value={selectedValue}
              isItemEqualToValue={(a, b) => a.value === b.value}
              onValueChange={(next) => {
                setSelectedIds((next ?? []).map((item) => item.value));
              }}
            >
              <ComboboxChips ref={chipsAnchorRef} className="w-full">
                <ComboboxValue>
                  {(values: AlsoCreateInGroupOption[]) =>
                    values.map((item) => <ComboboxChip key={item.value}>{item.label}</ComboboxChip>)
                  }
                </ComboboxValue>
                <ComboboxChipsInput
                  placeholder={
                    selectedValue.length === 0 ? t("teamsAlsoCreateInPlaceholder") : undefined
                  }
                  aria-label={t("teamsCopyToLabel")}
                />
              </ComboboxChips>
              <ComboboxContent anchor={chipsAnchorRef}>
                <ComboboxEmpty>{t("teamsAlsoCreateInEmpty")}</ComboboxEmpty>
                <ComboboxList>
                  {(item: AlsoCreateInGroupOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {tCommon("goBack")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            disabled={!canSubmit}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t("teamsCopyAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
