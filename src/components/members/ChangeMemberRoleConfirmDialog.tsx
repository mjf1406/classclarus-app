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

type ChangeMemberRoleConfirmDialogProps = {
  open: boolean;
  memberName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ChangeMemberRoleConfirmDialog({
  open,
  memberName,
  onOpenChange,
  onConfirm,
}: ChangeMemberRoleConfirmDialogProps) {
  const { t } = useTranslation("classes");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("roleChangeClearsOverridesTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("roleChangeClearsOverridesDescription", { name: memberName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm();
            }}
          >
            {t("roleChangeClearsOverridesConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
