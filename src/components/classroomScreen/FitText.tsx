import { useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useFitFontSize } from "@/hooks/classroomScreen/useFitFontSize";

interface FitTextProps {
  benchmark: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxFontSize?: number;
}

export function FitText({ benchmark, children, className, style, maxFontSize }: FitTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fontSize = useFitFontSize(ref, benchmark, undefined, maxFontSize);

  return (
    <div
      ref={ref}
      className={cn("flex h-full w-full items-center justify-center text-center", className)}
      style={{ fontSize, ...style }}
    >
      {children}
    </div>
  );
}
