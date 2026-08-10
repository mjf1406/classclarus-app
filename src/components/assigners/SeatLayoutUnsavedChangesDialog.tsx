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
import { Spinner } from "@/components/ui/spinner";

type SeatLayoutUnsavedChangesDialogProps = {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
};

export function SeatLayoutUnsavedChangesDialog({
  open,
  saving,
  onCancel,
  onDiscard,
  onSaveAndLeave,
}: SeatLayoutUnsavedChangesDialogProps) {
  const { t } = useTranslation("assigners");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("unsavedChangesTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("unsavedChangesDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col-reverse sm:justify-stretch sm:gap-2 sm:[&>button]:w-full">
          <AlertDialogAction variant="outline" disabled={saving} onClick={onDiscard}>
            {t("unsavedDiscard")}
          </AlertDialogAction>
          <AlertDialogCancel disabled={saving} onClick={onCancel}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={onSaveAndLeave}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {t("saveAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
