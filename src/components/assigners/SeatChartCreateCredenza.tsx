import { useMemo, useState } from "react";
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
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

type SeatChartCreateCredenzaProps = {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (args: { name: string; layoutId: Id<"seatLayouts"> }) => Promise<void>;
};

export function SeatChartCreateCredenza({
  classId,
  open,
  onOpenChange,
  onSubmit,
}: SeatChartCreateCredenzaProps) {
  const { t } = useTranslation("assigners");
  const { data: layouts, isPending } = useSeatLayouts(classId);
  const [name, setName] = useState("");
  const [layoutId, setLayoutId] = useState<Id<"seatLayouts"> | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedLayouts = useMemo(
    () => (layouts ? [...layouts].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [layouts],
  );
  const selectedLayoutName = sortedLayouts.find((layout) => layout._id === layoutId)?.name;

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
          if (next) {
            setName("");
            setLayoutId(undefined);
            setError(null);
          }
        }
      }}
    >
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{t("createChartTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("createChartDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          {isPending ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
          {!isPending && sortedLayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("chartNoLayouts")}</p>
          ) : null}
          {!isPending && sortedLayouts.length > 0 ? (
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="chart-create-name">{t("chartNameLabel")}</FieldLabel>
                <Input
                  id="chart-create-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>{t("chartLayoutLabel")}</FieldLabel>
                <Select
                  value={layoutId}
                  onValueChange={(value) => {
                    if (value) setLayoutId(value as Id<"seatLayouts">);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("chartLayoutPlaceholder")}>
                      {selectedLayoutName}
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
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </FieldGroup>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || sortedLayouts.length === 0}
            onClick={() => {
              void (async () => {
                const trimmed = name.trim();
                if (!trimmed) {
                  setError(t("nameRequired"));
                  return;
                }
                if (!layoutId) {
                  setError(t("chartLayoutRequired"));
                  return;
                }
                setPending(true);
                onOpenChange(false);
                try {
                  await onSubmit({ name: trimmed, layoutId });
                } catch (submitError) {
                  onOpenChange(true);
                  setError(
                    submitError instanceof Error ? submitError.message : t("chartSaveFailed"),
                  );
                } finally {
                  setPending(false);
                }
              })();
            }}
          >
            {t("createChart")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
