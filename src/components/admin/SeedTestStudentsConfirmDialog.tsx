import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast-manager";
import { useSeedTestStudents, type SeedTestStudentsArgs } from "@/hooks/admin/useSeedTestStudents";
import type { Id } from "../../../convex/_generated/dataModel";

const MAX_PER_GENDER = 40;

type SeedTestStudentsConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  classDisplayName: string;
};

export function SeedTestStudentsConfirmDialog({
  open,
  onOpenChange,
  classId,
  classDisplayName,
}: SeedTestStudentsConfirmDialogProps) {
  const { t } = useTranslation("admin");
  const seed = useSeedTestStudents();
  const [boyCount, setBoyCount] = useState("14");
  const [girlCount, setGirlCount] = useState("14");
  const [namePrefix, setNamePrefix] = useState("");
  const [replaceExistingSeed, setReplaceExistingSeed] = useState(true);
  const [errors, setErrors] = useState<{
    boyCount?: string;
    girlCount?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setBoyCount("14");
    setGirlCount("14");
    setNamePrefix("");
    setReplaceExistingSeed(true);
    setErrors({});
  }, [open, classId]);

  const validate = (): SeedTestStudentsArgs | null => {
    const next: typeof errors = {};
    const boys = Number.parseInt(boyCount, 10);
    const girls = Number.parseInt(girlCount, 10);
    if (!Number.isFinite(boys) || boys < 0 || boys > MAX_PER_GENDER) {
      next.boyCount = t("seedCountInvalid", { max: MAX_PER_GENDER });
    }
    if (!Number.isFinite(girls) || girls < 0 || girls > MAX_PER_GENDER) {
      next.girlCount = t("seedCountInvalid", { max: MAX_PER_GENDER });
    }
    if (
      Number.isFinite(boys) &&
      Number.isFinite(girls) &&
      boys >= 0 &&
      girls >= 0 &&
      boys + girls === 0
    ) {
      next.boyCount = t("seedCountAtLeastOne");
      next.girlCount = t("seedCountAtLeastOne");
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    const prefix = namePrefix.trim();
    return {
      classId,
      boyCount: boys,
      girlCount: girls,
      namePrefix: prefix.length > 0 ? prefix : undefined,
      replaceExistingSeed,
    };
  };

  const handleConfirm = () => {
    if (seed.isPending) return;
    const args = validate();
    if (!args) return;
    onOpenChange(false);
    void seed.mutateAsync(args).then(
      (result) => {
        toast.add({
          title: t("seedSuccess", {
            created: result.created,
            removed: result.removed,
          }),
          type: "success",
        });
      },
      () => {
        onOpenChange(true);
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("seedTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("seedConfirmDescription", { name: classDisplayName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={errors.boyCount ? true : undefined}>
              <FieldLabel htmlFor="admin-seed-boys">{t("seedBoyCountLabel")}</FieldLabel>
              <Input
                id="admin-seed-boys"
                type="number"
                min={0}
                max={MAX_PER_GENDER}
                value={boyCount}
                onChange={(event) => setBoyCount(event.target.value)}
                disabled={seed.isPending}
                aria-invalid={errors.boyCount ? true : undefined}
              />
              {errors.boyCount ? <FieldError>{errors.boyCount}</FieldError> : null}
            </Field>
            <Field data-invalid={errors.girlCount ? true : undefined}>
              <FieldLabel htmlFor="admin-seed-girls">{t("seedGirlCountLabel")}</FieldLabel>
              <Input
                id="admin-seed-girls"
                type="number"
                min={0}
                max={MAX_PER_GENDER}
                value={girlCount}
                onChange={(event) => setGirlCount(event.target.value)}
                disabled={seed.isPending}
                aria-invalid={errors.girlCount ? true : undefined}
              />
              {errors.girlCount ? <FieldError>{errors.girlCount}</FieldError> : null}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="admin-seed-prefix">{t("seedNamePrefixLabel")}</FieldLabel>
            <Input
              id="admin-seed-prefix"
              value={namePrefix}
              onChange={(event) => setNamePrefix(event.target.value)}
              disabled={seed.isPending}
              placeholder={t("seedNamePrefixPlaceholder")}
              autoComplete="off"
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={replaceExistingSeed}
              onCheckedChange={(value) => setReplaceExistingSeed(value === true)}
              disabled={seed.isPending}
              className="mt-0.5"
            />
            <span>{t("seedReplaceExisting")}</span>
          </label>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={seed.isPending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={seed.isPending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {t("seedSubmit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
