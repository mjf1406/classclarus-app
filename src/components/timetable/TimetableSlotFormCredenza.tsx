import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { TimetableSlot, TimetableTerm } from "@/lib/timetable/timetable";
import { useCreateTimetableSlot } from "@/hooks/timetable/useTimetableMutations";

type TimetableSlotFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  term: TimetableTerm;
  year: number;
  weekNumber: number;
  slot?: TimetableSlot | null;
};

export function TimetableSlotFormCredenza({
  open,
  onOpenChange,
  classId,
  term,
  year,
  weekNumber,
  slot,
}: TimetableSlotFormCredenzaProps) {
  const { t } = useTranslation("timetable");
  const createSlot = useCreateTimetableSlot();
  const updateSlot = useConvexMutation(api.timetable.updateSlot);
  const [day, setDay] = useState(term.days[0] ?? "Monday");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:30");
  const [disabled, setDisabled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (slot) {
      setDay(slot.day);
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
      setDisabled(slot.disabled);
    } else {
      setDay(term.days[0] ?? "Monday");
      setStartTime(term.startTime);
      setEndTime(term.endTime);
      setDisabled(false);
    }
  }, [open, slot, term]);

  const submit = async () => {
    setPending(true);
    try {
      if (slot) {
        await updateSlot({
          classId,
          slotId: slot._id,
          day,
          startTime,
          endTime,
          disabled,
        });
      } else {
        await createSlot.mutateAsync({
          classId,
          termId: term._id,
          year,
          weekNumber,
          day,
          startTime,
          endTime,
        });
      }
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{slot ? t("editSlotTitle") : t("createSlotTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("slotFormDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t("slotDay")}</Label>
            <Select value={day} onValueChange={(v) => v && setDay(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {term.days.map((d: string) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="slot-start">{t("startTime")}</Label>
              <Input
                id="slot-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot-end">{t("endTime")}</Label>
              <Input
                id="slot-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button variant="outline" />}>{t("cancel")}</CredenzaClose>
          <Button onClick={() => void submit()} disabled={pending || createSlot.isPending}>
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
