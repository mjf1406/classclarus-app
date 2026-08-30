import { useId, useMemo, useState } from "react";
import { TextQuote } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClientAgendaPrefaceSchema } from "@/lib/timetable/timetableFormSchema";

type TimetableAgendaPrefaceButtonProps = {
  preface?: string;
  onChange: (preface: string | undefined) => void;
};

export function TimetableAgendaPrefaceButton({
  preface,
  onChange,
}: TimetableAgendaPrefaceButtonProps) {
  const { t } = useTranslation("timetable");
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preface ?? "");
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => createClientAgendaPrefaceSchema(t), [t]);
  const hasPreface = Boolean(preface?.trim());

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(preface ?? "");
      setError(null);
    }
  };

  const apply = () => {
    const parsed = schema.safeParse({ preface: draft });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("validationItemTextTooLong"));
      return;
    }
    const next = parsed.data.preface.trim() || undefined;
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant={hasPreface ? "secondary" : "ghost"}
            size="icon"
            className="shrink-0"
            aria-label={hasPreface ? t("editAgendaPreface") : t("addAgendaPreface")}
          />
        }
      >
        <TextQuote />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle className="text-sm">{t("agendaPreface")}</PopoverTitle>
        </PopoverHeader>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={fieldId} className="sr-only">
            {t("agendaPreface")}
          </FieldLabel>
          <Input
            id={fieldId}
            value={draft}
            placeholder={t("agendaPrefacePlaceholder")}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              apply();
            }}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            {t("clearAgendaPreface")}
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            {t("applyAgendaPreface")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
