import { useEffect, useState, type RefObject } from "react";

import { computeFitFontSize, parseLineHeightMultiplier } from "@/lib/classroomScreen/fitFontSize";

const DEFAULT_MAX_WIDTH_RATIO = 0.97;
const DEFAULT_MAX_HEIGHT_RATIO = 0.95;
const MAX_FONT_SIZE = 500;

export function useFitFontSize(
  ref: RefObject<HTMLElement | null>,
  benchmark: string,
  maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO,
  maxFontSize = MAX_FONT_SIZE,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
): number | undefined {
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const computed = getComputedStyle(el);
      const lineHeightMultiplier = parseLineHeightMultiplier(computed.lineHeight, 16);
      const size = computeFitFontSize(
        el.clientWidth,
        el.clientHeight,
        benchmark,
        maxWidthRatio,
        maxHeightRatio,
        computed.fontFamily,
        computed.fontWeight,
        lineHeightMultiplier,
        maxFontSize,
      );
      setFontSize(size);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, benchmark, maxWidthRatio, maxHeightRatio, maxFontSize]);

  return fontSize;
}
