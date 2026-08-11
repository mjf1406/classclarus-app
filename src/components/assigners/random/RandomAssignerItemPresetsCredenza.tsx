import { useState } from "react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mergeRandomAssignerPresetItems,
  RANDOM_ASSIGNER_ITEM_PRESET_IDS,
  randomAssignerPresetMaxCount,
  type RandomAssignerItemPresetId,
} from "@/lib/assigners/randomAssigners";

const DEFAULT_PRESET_ID: RandomAssignerItemPresetId = "letters";
const DEFAULT_COUNT = 10;

type RandomAssignerItemPresetsCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: string[];
  onApply: (items: string[]) => void;
};

export function RandomAssignerItemPresetsCredenza({
  open,
  onOpenChange,
  items,
  onApply,
}: RandomAssignerItemPresetsCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [presetId, setPresetId] = useState<RandomAssignerItemPresetId>(DEFAULT_PRESET_ID);
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [draftItems, setDraftItems] = useState(items);

  const maxCount = randomAssignerPresetMaxCount(presetId);

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPresetId(DEFAULT_PRESET_ID);
          setCount(DEFAULT_COUNT);
          setDraftItems(items);
        }
        onOpenChange(next);
      }}
    >
      <CredenzaContent className="sm:max-w-md">
        <CredenzaHeader>
          <CredenzaTitle>{t("randomItemPresetsTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("randomItemPresetsHint")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>{t("randomItemPresetTypeLabel")}</FieldLabel>
              <Select
                value={presetId}
                onValueChange={(value) => {
                  const next = value as RandomAssignerItemPresetId;
                  setPresetId(next);
                  setCount((current) => Math.min(current, randomAssignerPresetMaxCount(next)));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{t(`randomItemPreset_${presetId}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RANDOM_ASSIGNER_ITEM_PRESET_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {t(`randomItemPreset_${id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t(`randomItemPresetDesc_${presetId}`)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="random-preset-count">
                {t("randomItemPresetCountLabel")}
              </FieldLabel>
              <NumberInput
                id="random-preset-count"
                value={count}
                min={1}
                max={maxCount}
                onValueChange={setCount}
              />
            </Field>
          </FieldGroup>
        </CredenzaBody>
        <CredenzaFooter className="flex-row justify-between gap-2">
          <CredenzaClose render={<Button type="button" variant="outline" className="flex-1" />}>
            {t("randomItemPresetsDone")}
          </CredenzaClose>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              const nextItems = mergeRandomAssignerPresetItems(draftItems, presetId, count);
              setDraftItems(nextItems);
              onApply(nextItems);
              onOpenChange(false);
            }}
          >
            {t("randomItemPresetAdd")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
