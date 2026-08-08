import { CircleHelpIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type HelpTipProps = {
  title: string;
  description: string;
  /** Accessible name for the help button. Defaults to common.help. */
  ariaLabel?: string;
  side?: "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
  className?: string;
};

/**
 * Optional clickable help control — works on touch (unlike hover tooltips).
 */
export function HelpTip({ title, description, ariaLabel, side = "top", className }: HelpTipProps) {
  const { t } = useTranslation("common");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 text-muted-foreground", className)}
            aria-label={ariaLabel ?? t("help")}
          />
        }
      >
        <CircleHelpIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side={side} align="center" className="w-64 gap-2 p-3">
        <PopoverHeader className="gap-1">
          <PopoverTitle className="text-sm">{title}</PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed">{description}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
