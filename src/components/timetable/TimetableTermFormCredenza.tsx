import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTimetableTerm } from "@/hooks/timetable/useCreateTimetableTerm";
import { type TimetableTerm, type TimetableTermKind } from "@/lib/timetable/timetable";
import { WEEKDAY_NAMES } from "@/lib/timetable/utils";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableTermFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  existingTerms: Array<TimetableTerm>;
  onCreated?: (termId: Id<"timetableTerms">) => void;
};

const KINDS: Array<TimetableTermKind> = ["quarter", "semester", "trimester", "year", "custom"];

export function TimetableTermFormCredenza({
  open,
  onOpenChange,
  classId,
  existingTerms,
  onCreated,
}: TimetableTermFormCredenzaProps) {
  const { t } = useTranslation("timetable");
  const createTerm = useCreateTimetableTerm();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TimetableTermKind>("semester");
  const [startDateKey, setStartDateKey] = useState("");
  const [endDateKey, setEndDateKey] = useState("");
  const [days, setDays] = useState<Array<string>>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("15:00");
  const [copyFromTermId, setCopyFromTermId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setKind("semester");
    setStartDateKey("");
    setEndDateKey("");
    setDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setStartTime("08:00");
    setEndTime("15:00");
    setCopyFromTermId("");
  }, [open]);

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const submit = async () => {
    const termId = await createTerm.mutateAsync({
      classId,
      name,
      kind,
      startDateKey,
      endDateKey,
      days,
      startTime,
      endTime,
      copySlotsFromTermId: copyFromTermId ? (copyFromTermId as Id<"timetableTerms">) : undefined,
    });
    onCreated?.(termId);
    onOpenChange(false);
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{t("createTermTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("createTermDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="term-name">{t("termName")}</Label>
            <Input id="term-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("termKind")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as TimetableTermKind)}>
              <SelectTrigger>
                <SelectValue>{t(`termKind_${kind}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`termKind_${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="term-start">{t("startDate")}</Label>
              <Input
                id="term-start"
                type="date"
                value={startDateKey}
                onChange={(e) => setStartDateKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-end">{t("endDate")}</Label>
              <Input
                id="term-end"
                type="date"
                value={endDateKey}
                onChange={(e) => setEndDateKey(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="term-start-time">{t("dayStart")}</Label>
              <Input
                id="term-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term-end-time">{t("dayEnd")}</Label>
              <Input
                id="term-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("meetingDays")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {WEEKDAY_NAMES.map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={days.includes(day)} onCheckedChange={() => toggleDay(day)} />
                  {day}
                </label>
              ))}
            </div>
          </div>
          {existingTerms.length > 0 ? (
            <div className="space-y-2">
              <Label>{t("copySlotsFrom")}</Label>
              <Select
                value={copyFromTermId || "__none__"}
                onValueChange={(v) => setCopyFromTermId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("copySlotsNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("copySlotsNone")}</SelectItem>
                  {existingTerms.map((term) => (
                    <SelectItem key={term._id} value={term._id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button variant="outline" />}>{t("cancel")}</CredenzaClose>
          <Button onClick={() => void submit()} disabled={createTerm.isPending}>
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
