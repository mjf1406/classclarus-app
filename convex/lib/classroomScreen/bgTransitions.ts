export const BG_TRANSITION_MS = 700;

export type OverlayStyle = Record<string, string | number>;

const STAR_POINTS = 10;
const HEXAGON_POINTS = 6;

function centerPolygon(pointCount: number): string {
  const points = Array.from({ length: pointCount }, () => "50% 50%").join(", ");
  return `polygon(${points})`;
}

const SHAPE_CLIP_PATHS = {
  diamond: {
    hidden: centerPolygon(4),
    visible: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  },
  star: {
    hidden: centerPolygon(STAR_POINTS),
    visible:
      "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
  hexagon: {
    hidden: centerPolygon(HEXAGON_POINTS),
    visible: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
} as const;

export const BG_TRANSITION_OPTIONS = [
  { value: "circle" },
  { value: "square" },
  { value: "diamond" },
  { value: "star" },
  { value: "hexagon" },
  { value: "fade" },
  { value: "slideUp" },
  { value: "slideDown" },
  { value: "wipeLeft" },
  { value: "wipeRight" },
  { value: "instant" },
] as const;

export type BgTransition = (typeof BG_TRANSITION_OPTIONS)[number]["value"];

export const DEFAULT_BG_TRANSITION: BgTransition = "circle";
export const BG_TRANSITION_GLOBAL_VALUE = "__global__";

export function isBgTransition(value: string): value is BgTransition {
  return BG_TRANSITION_OPTIONS.some((option) => option.value === value);
}

export function resolveBgTransition(
  override: string | undefined,
  globalDefault: BgTransition,
): BgTransition {
  if (override && override !== BG_TRANSITION_GLOBAL_VALUE && isBgTransition(override)) {
    return override;
  }
  return globalDefault;
}

function shapeRevealStyle(
  active: boolean,
  hiddenClipPath: string,
  visibleClipPath: string,
  duration: string,
): OverlayStyle {
  return {
    transitionProperty: "clip-path, opacity",
    transitionDuration: duration,
    transitionTimingFunction: "ease-in-out",
    clipPath: active ? visibleClipPath : hiddenClipPath,
    opacity: active ? 1 : 0.85,
  };
}

export function getOverlayStyle(transition: BgTransition, active: boolean): OverlayStyle {
  const duration = transition === "instant" ? "0ms" : `${BG_TRANSITION_MS}ms`;
  const timing = "ease-in-out";

  switch (transition) {
    case "instant":
      return { opacity: active ? 1 : 0 };
    case "fade":
      return {
        transitionProperty: "opacity",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        opacity: active ? 1 : 0,
      };
    case "slideUp":
      return {
        transitionProperty: "transform",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        transform: active ? "translateY(0)" : "translateY(100%)",
      };
    case "slideDown":
      return {
        transitionProperty: "transform",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        transform: active ? "translateY(0)" : "translateY(-100%)",
      };
    case "wipeLeft":
      return {
        transitionProperty: "clip-path",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        clipPath: active ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
      };
    case "wipeRight":
      return {
        transitionProperty: "clip-path",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        clipPath: active ? "inset(0 0 0 0)" : "inset(0 0 0 100%)",
      };
    case "square":
      return shapeRevealStyle(active, "inset(50% 50% 50% 50%)", "inset(0% 0% 0% 0%)", duration);
    case "diamond":
      return shapeRevealStyle(
        active,
        SHAPE_CLIP_PATHS.diamond.hidden,
        SHAPE_CLIP_PATHS.diamond.visible,
        duration,
      );
    case "star":
      return shapeRevealStyle(
        active,
        SHAPE_CLIP_PATHS.star.hidden,
        SHAPE_CLIP_PATHS.star.visible,
        duration,
      );
    case "hexagon":
      return shapeRevealStyle(
        active,
        SHAPE_CLIP_PATHS.hexagon.hidden,
        SHAPE_CLIP_PATHS.hexagon.visible,
        duration,
      );
    case "circle":
    default:
      return {
        transitionProperty: "clip-path, opacity",
        transitionDuration: duration,
        transitionTimingFunction: timing,
        clipPath: active ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
        opacity: active ? 1 : 0.85,
      };
  }
}
