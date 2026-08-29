import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { useFitFontSize } from "@/hooks/classroomScreen/useFitFontSize";
import type { FitFontAxis } from "@/lib/classroomScreen/fitFontSize";

interface FitTextProps {
  benchmark: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxFontSize?: number;
  fitAxis?: FitFontAxis;
  measureRef?: RefObject<HTMLElement | null>;
  availableHeight?: number;
}

export function FitText({
  benchmark,
  children,
  className,
  style,
  maxFontSize,
  fitAxis = "both",
  measureRef,
  availableHeight,
}: FitTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fontSize = useFitFontSize(
    ref,
    benchmark,
    undefined,
    maxFontSize,
    undefined,
    fitAxis,
    measureRef,
    availableHeight,
  );
  const contentSized = fitAxis === "width" || measureRef != null;

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-w-0 w-full items-center justify-center overflow-hidden text-center leading-none",
        contentSized ? "h-auto shrink-0" : "h-full min-h-0",
        className,
      )}
      style={{ ...style, fontSize }}
    >
      {children}
    </div>
  );
}
