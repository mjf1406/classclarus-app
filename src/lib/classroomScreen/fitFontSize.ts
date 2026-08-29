export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 500;

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

export function parseLineHeightMultiplier(lineHeight: string, fontSize: number): number {
  const trimmed = lineHeight.trim();
  if (trimmed.endsWith("px")) {
    const px = Number.parseFloat(trimmed);
    return px > 0 ? px / fontSize : 1.2;
  }
  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return 1.2;
}

function measureTextHeight(fontSize: number, lineHeightMultiplier: number): number {
  return fontSize * lineHeightMultiplier;
}

export function computeFitFontSize(
  containerWidth: number,
  containerHeight: number,
  benchmark: string,
  maxWidthRatio: number,
  maxHeightRatio: number,
  fontFamily: string,
  fontWeight: string,
  lineHeightMultiplier: number,
  maxFontSize = MAX_FONT_SIZE,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return MIN_FONT_SIZE;

  const maxWidth = containerWidth * maxWidthRatio;
  const maxHeight = containerHeight * maxHeightRatio;
  let lo = MIN_FONT_SIZE;
  let hi = maxFontSize;
  let best = MIN_FONT_SIZE;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const width = measureTextWidth(benchmark, mid, fontFamily, fontWeight);
    const height = measureTextHeight(mid, lineHeightMultiplier);
    if (width <= maxWidth && height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}
