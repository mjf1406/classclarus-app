import { useEffect, useState, type RefObject } from "react";

const DEFAULT_MAX_WIDTH_RATIO = 0.97;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 500;

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  return measureCanvas.getContext("2d");
}

function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
): number {
  const ctx = getMeasureContext();
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

function computeFitFontSize(
  containerWidth: number,
  benchmark: string,
  maxWidthRatio: number,
  fontFamily: string,
  fontWeight: string,
  maxFontSize = MAX_FONT_SIZE,
): number {
  if (containerWidth <= 0) return MIN_FONT_SIZE;

  const maxWidth = containerWidth * maxWidthRatio;
  let lo = MIN_FONT_SIZE;
  let hi = maxFontSize;
  let best = MIN_FONT_SIZE;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const width = measureTextWidth(benchmark, mid, fontFamily, fontWeight);
    if (width <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

export function useFitFontSize(
  ref: RefObject<HTMLElement | null>,
  benchmark: string,
  maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO,
  maxFontSize = MAX_FONT_SIZE,
): number | undefined {
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const computed = getComputedStyle(el);
      const size = computeFitFontSize(
        el.clientWidth,
        benchmark,
        maxWidthRatio,
        computed.fontFamily,
        computed.fontWeight,
        maxFontSize,
      );
      setFontSize(size);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, benchmark, maxWidthRatio, maxFontSize]);

  return fontSize;
}
