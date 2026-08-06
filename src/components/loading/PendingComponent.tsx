import { useTranslation } from "react-i18next";

import { Icon } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

interface PendingComponentProps {
  message?: string;
  /** Fill remaining viewport under chrome (e.g. Navbar) instead of full screen. */
  inset?: boolean;
}

export default function PendingComponent({ message, inset = false }: PendingComponentProps) {
  const { t } = useTranslation("common");
  const label = message ?? t("loading");

  return (
    <div
      className={cn(
        "flex items-center justify-center p-4",
        inset ? "min-h-[calc(100dvh-3.5rem)] w-full" : "min-h-screen min-w-screen",
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <Icon className="size-24 animate-spin" />
        <span className="text-muted-foreground text-lg">{label}</span>
      </div>
    </div>
  );
}
