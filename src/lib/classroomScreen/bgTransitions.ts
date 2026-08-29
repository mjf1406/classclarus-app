export {
  BG_TRANSITION_GLOBAL_VALUE,
  BG_TRANSITION_MS,
  BG_TRANSITION_OPTIONS,
  DEFAULT_BG_TRANSITION,
  getOverlayStyle,
  isBgTransition,
  resolveBgTransition,
  type BgTransition,
} from "../../../convex/lib/classroomScreen/bgTransitions";

export const BG_TRANSITION_LABEL_KEYS = {
  circle: "bgTransitionCircle",
  square: "bgTransitionSquare",
  diamond: "bgTransitionDiamond",
  star: "bgTransitionStar",
  hexagon: "bgTransitionHexagon",
  fade: "bgTransitionFade",
  slideUp: "bgTransitionSlideUp",
  slideDown: "bgTransitionSlideDown",
  wipeLeft: "bgTransitionWipeLeft",
  wipeRight: "bgTransitionWipeRight",
  instant: "bgTransitionInstant",
} as const;
