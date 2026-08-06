import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type OverflowTooltipProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  children: ReactNode;
  tooltipContent?: ReactNode;
  side?: ComponentPropsWithoutRef<typeof TooltipContent>["side"];
  sideOffset?: ComponentPropsWithoutRef<typeof TooltipContent>["sideOffset"];
  align?: ComponentPropsWithoutRef<typeof TooltipContent>["align"];
};

function isOverflowing(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
}

function OverflowTooltip({
  children,
  className,
  tooltipContent,
  side = "top",
  sideOffset,
  align,
  ...props
}: OverflowTooltipProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }

    const check = () => {
      setOverflowing(isOverflowing(element));
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [children]);

  useEffect(() => {
    if (!overflowing) {
      setOpen(false);
    }
  }, [overflowing]);

  return (
    <Tooltip
      open={overflowing ? open : false}
      onOpenChange={(nextOpen) => {
        if (overflowing) {
          setOpen(nextOpen);
        }
      }}
    >
      <TooltipTrigger
        render={
          <span ref={textRef} className={cn("block min-w-0 truncate", className)} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      {overflowing ? (
        <TooltipContent side={side} sideOffset={sideOffset} align={align}>
          {tooltipContent ?? children}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

export { OverflowTooltip };
export type { OverflowTooltipProps };
