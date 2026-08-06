import type { ReactNode } from "react";

import i18n from "@/i18n";
import { toast } from "@/components/ui/toast-manager";

type UndoToastOptions = {
  title: ReactNode;
  description?: ReactNode;
  onUndo: () => void | Promise<void>;
  undoLabel?: ReactNode;
  timeout?: number;
  errorTitle?: ReactNode;
  errorDescription?: ReactNode;
};

function undoToast(options: UndoToastOptions): string {
  let undoing = false;

  const id = toast.add({
    title: options.title,
    description: options.description,
    type: "success",
    timeout: options.timeout ?? 5000,
    actionProps: {
      children: options.undoLabel ?? i18n.t("common:undo"),
      onClick: () => {
        if (undoing) {
          return;
        }
        undoing = true;
        toast.close(id);

        void Promise.resolve(options.onUndo()).catch(() => {
          toast.add({
            title: options.errorTitle ?? i18n.t("common:undoFailed"),
            description: options.errorDescription,
            type: "error",
          });
        });
      },
    },
  });

  return id;
}

export { undoToast };
export type { UndoToastOptions };
