import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProgressButton, type ProgressButtonProps } from "@/components/ui/progress-button";

type AutoAssignProgressButtonProps = Omit<ProgressButtonProps, "progress" | "children"> & {
  progress: number;
  children?: ProgressButtonProps["children"];
};

export function AutoAssignProgressButton({
  progress,
  pending,
  variant = "outline",
  children,
  ...props
}: AutoAssignProgressButtonProps) {
  const { t } = useTranslation("assigners");

  return (
    <ProgressButton
      type="button"
      variant={variant}
      progress={progress}
      pending={pending}
      aria-label={t("autoAssign")}
      {...props}
    >
      <Cpu data-icon="inline-start" />
      {children ?? t("autoAssign")}
    </ProgressButton>
  );
}
