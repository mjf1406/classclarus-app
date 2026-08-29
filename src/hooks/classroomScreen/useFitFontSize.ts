import { useLayoutEffect, useState, type RefObject } from "react";

import {
  computeFitFontSize,
  parseLineHeightMultiplier,
  remainingFitHeight,
  type FitFontAxis,
} from "@/lib/classroomScreen/fitFontSize";

const DEFAULT_MAX_WIDTH_RATIO = 0.97;
const DEFAULT_MAX_HEIGHT_RATIO = 0.95;
const MAX_FONT_SIZE = 500;

function participatingChildCount(container: HTMLElement): number {
  return [...container.children].filter((child) => getComputedStyle(child).display !== "none")
    .length;
}

export function useReservedFitHeight(
  containerRef: RefObject<HTMLElement | null>,
  reservedTopRef: RefObject<HTMLElement | null>,
  reservedBottomRef: RefObject<HTMLElement | null>,
  layoutKey: string,
): number {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const style = getComputedStyle(container);
      const paddingY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const gap = Number.parseFloat(style.rowGap) || 0;
      const next = remainingFitHeight(
        container.clientHeight,
        paddingY,
        gap,
        participatingChildCount(container),
        [reservedTopRef.current?.offsetHeight ?? 0, reservedBottomRef.current?.offsetHeight ?? 0],
      );
      setHeight((current) => (current === next ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (reservedTopRef.current) observer.observe(reservedTopRef.current);
    if (reservedBottomRef.current) observer.observe(reservedBottomRef.current);
    return () => observer.disconnect();
  }, [containerRef, reservedTopRef, reservedBottomRef, layoutKey]);

  return height;
}

export function useFitFontSize(
  ref: RefObject<HTMLElement | null>,
  benchmark: string,
  maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO,
  maxFontSize = MAX_FONT_SIZE,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  fitAxis: FitFontAxis = "both",
  measureRef?: RefObject<HTMLElement | null>,
  availableHeight?: number,
): number | undefined {
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const display = ref.current;
    const measure = measureRef?.current ?? display;
    if (!display || !measure) return;

    const update = () => {
      const computed = getComputedStyle(display);
      const computedFontSize = Number.parseFloat(computed.fontSize);
      const lineHeightMultiplier = parseLineHeightMultiplier(
        computed.lineHeight,
        Number.isFinite(computedFontSize) && computedFontSize > 0 ? computedFontSize : 16,
      );
      const size = computeFitFontSize(
        measure.clientWidth,
        availableHeight ?? measure.clientHeight,
        benchmark,
        maxWidthRatio,
        maxHeightRatio,
        computed.fontFamily,
        computed.fontWeight,
        lineHeightMultiplier,
        maxFontSize,
        fitAxis,
      );
      setFontSize(size);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [
    ref,
    measureRef,
    benchmark,
    maxWidthRatio,
    maxHeightRatio,
    maxFontSize,
    fitAxis,
    availableHeight,
  ]);

  return fontSize;
}
