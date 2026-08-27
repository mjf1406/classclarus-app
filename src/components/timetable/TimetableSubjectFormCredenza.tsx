import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId } from "@/components/icons/fontawesome-icon-catalog";
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
import { useCreateTimetableSubject } from "@/hooks/timetable/useTimetableMutations";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableSubjectFormCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
};

export function TimetableSubjectFormCredenza({
  open,
  onOpenChange,
  classId,
  termId,
  year,
  weekNumber,
}: TimetableSubjectFormCredenzaProps) {
  const { t } = useTranslation("timetable");
  const createSubject = useCreateTimetableSubject();
  const [name, setName] = useState("");
  const [bgColor, setBgColor] = useState("#6366f1");
  const [textColor, setTextColor] = useState("#ffffff");
  const [iconName, setIconName] = useState("");
  const [faIcon, setFaIcon] = useState<IconDefinition | undefined>();

  useEffect(() => {
    if (!open) return;
    setName("");
    setBgColor("#6366f1");
    setTextColor("#ffffff");
    setIconName("");
    setFaIcon(undefined);
  }, [open]);

  const submit = async () => {
    await createSubject.mutateAsync({
      classId,
      termId,
      year,
      weekNumber,
      name,
      bgColor,
      textColor,
      iconName: iconName || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{t("createSubjectTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("createSubjectDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject-name">{t("subjectName")}</Label>
            <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="subject-bg">{t("backgroundColor")}</Label>
              <Input
                id="subject-bg"
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject-text">{t("textColor")}</Label>
              <Input
                id="subject-text"
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("subjectIcon")}</Label>
            <FontAwesomeIconPickerLazy
              value={faIcon}
              onChange={(icon) => {
                setFaIcon(icon);
                setIconName(iconDefinitionToId(icon));
              }}
            />
          </div>
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button variant="outline" />}>{t("cancel")}</CredenzaClose>
          <Button onClick={() => void submit()} disabled={createSubject.isPending}>
            {t("saveAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
