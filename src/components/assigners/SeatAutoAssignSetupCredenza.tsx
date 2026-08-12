import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";
import { defaultAutoAssignChartName } from "@/lib/assigners/seatAssignmentScope";

export type SeatAutoAssignMode = "create" | "update";

export type SeatAutoAssignSetupValues = {
  layoutId: Id<"seatLayouts">;
  layoutName: string;
  chartName: string;
};

type SeatAutoAssignSetupCredenzaProps = {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create = new chart (layouts/charts list); update = fill this chart (chart editor). */
  mode?: SeatAutoAssignMode;
  fixedLayoutId?: Id<"seatLayouts">;
  fixedLayoutName?: string;
  onSubmit: (values: SeatAutoAssignSetupValues) => Promise<void>;
  isRunning?: boolean;
};

export function SeatAutoAssignSetupCredenza({
  classId,
  open,
  onOpenChange,
  mode = "create",
  fixedLayoutId,
  fixedLayoutName,
  onSubmit,
  isRunning = false,
}: SeatAutoAssignSetupCredenzaProps) {
  const { t } = useTranslation("assigners");
  const { data: layouts, isPending } = useSeatLayouts(classId);
  const [layoutId, setLayoutId] = useState<Id<"seatLayouts"> | null>(fixedLayoutId ?? null);
  const [chartName, setChartName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUpdate = mode === "update";

  const sortedLayouts = useMemo(
    () => (layouts ? [...layouts].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [layouts],
  );

  const selectedLayout =
    sortedLayouts.find((layout) => layout._id === layoutId) ??
    (fixedLayoutId && fixedLayoutName
      ? { _id: fixedLayoutId, name: fixedLayoutName, deskCount: 0 }
      : undefined);

  useEffect(() => {
    if (!open) return;
    setLayoutId(fixedLayoutId ?? null);
    setError(null);
    setPending(false);
    if (isUpdate) {
      setChartName("");
      return;
    }
    if (fixedLayoutName) {
      setChartName(defaultAutoAssignChartName(fixedLayoutName));
    } else {
      setChartName("");
    }
  }, [open, fixedLayoutId, fixedLayoutName, isUpdate]);

  const handleSubmit = async () => {
    const resolvedLayoutId = fixedLayoutId ?? layoutId;
    if (!resolvedLayoutId || !selectedLayout) {
      setError(t("chartLayoutRequired"));
      return;
    }

    let trimmedName = chartName.trim();
    if (!isUpdate) {
      if (!trimmedName) {
        setError(t("nameRequired"));
        return;
      }
    } else {
      trimmedName = selectedLayout.name;
    }

    setPending(true);
    setError(null);
    onOpenChange(false);
    try {
      await onSubmit({
        layoutId: resolvedLayoutId,
        layoutName: selectedLayout.name,
        chartName: trimmedName,
      });
    } catch (submitError) {
      onOpenChange(true);
      setPending(false);
      setError(submitError instanceof Error ? submitError.message : t("autoAssignFailed"));
    }
  };

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!pending && !isRunning) onOpenChange(next);
      }}
    >
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{t("autoAssignTitle")}</CredenzaTitle>
          <CredenzaDescription>
            {isUpdate ? t("autoAssignDescriptionUpdate") : t("autoAssignDescriptionCreate")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          {!fixedLayoutId && isPending ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
          {!fixedLayoutId && !isPending && sortedLayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("chartNoLayouts")}</p>
          ) : null}
          <FieldGroup>
            {!fixedLayoutId && sortedLayouts.length > 0 ? (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel>{t("chartLayoutLabel")}</FieldLabel>
                <Select
                  value={layoutId}
                  onValueChange={(value) => {
                    if (!value) return;
                    const nextId = value as Id<"seatLayouts">;
                    setLayoutId(nextId);
                    const layout = sortedLayouts.find((item) => item._id === nextId);
                    if (layout) setChartName(defaultAutoAssignChartName(layout.name));
                    setError(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("chartLayoutPlaceholder")}>
                      {selectedLayout?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {sortedLayouts.map((layout) => (
                        <SelectItem key={layout._id} value={layout._id}>
                          {layout.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {fixedLayoutId && fixedLayoutName && !isUpdate ? (
              <Field>
                <FieldLabel>{t("chartLayoutLabel")}</FieldLabel>
                <p className="text-sm">{fixedLayoutName}</p>
              </Field>
            ) : null}
            {!isUpdate ? (
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel>{t("chartNameLabel")}</FieldLabel>
                <Input value={chartName} onChange={(event) => setChartName(event.target.value)} />
              </Field>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </CredenzaBody>
        <CredenzaFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending || isRunning}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || isRunning || (!fixedLayoutId && !layoutId)}
            onClick={() => void handleSubmit()}
          >
            {pending || isRunning ? <Spinner data-icon="inline-start" /> : null}
            {t("autoAssignAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
