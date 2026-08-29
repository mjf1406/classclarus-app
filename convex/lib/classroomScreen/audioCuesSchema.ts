import { v } from "convex/values";

export const audioCueSlotValidator = v.object({
  audioId: v.optional(v.union(v.string(), v.literal("none"))),
  repeat: v.optional(v.number()),
});

export const playDuringCueValidator = v.object({
  audioId: v.optional(v.union(v.string(), v.literal("none"))),
});

export const videoCueValidator = v.object({
  youtubeId: v.optional(v.union(v.string(), v.literal("none"))),
  position: v.optional(v.string()),
  size: v.optional(v.string()),
  muted: v.optional(v.boolean()),
});

export const countdownTickCueValidator = v.object({
  audioId: v.optional(v.union(v.string(), v.literal("none"))),
  lastSeconds: v.optional(v.number()),
});

export const intervalChimeCueValidator = v.object({
  audioId: v.optional(v.union(v.string(), v.literal("none"))),
  everyMinutes: v.optional(v.number()),
});

export const timeRemainingCueValidator = v.object({
  audioId: v.optional(v.union(v.string(), v.literal("none"))),
  secondsRemaining: v.number(),
  repeat: v.optional(v.number()),
});

/** Optional layered audio cue configuration stored on settings/timers. */
export const audioCuesValidator = v.optional(
  v.object({
    segmentStart: v.optional(audioCueSlotValidator),
    playDuring: v.optional(playDuringCueValidator),
    video: v.optional(videoCueValidator),
    segmentEnd: v.optional(audioCueSlotValidator),
    sessionComplete: v.optional(audioCueSlotValidator),
    overtimeStart: v.optional(audioCueSlotValidator),
    pause: v.optional(audioCueSlotValidator),
    resume: v.optional(audioCueSlotValidator),
    skip: v.optional(audioCueSlotValidator),
    stop: v.optional(audioCueSlotValidator),
    countdownTick: v.optional(countdownTickCueValidator),
    intervalChime: v.optional(intervalChimeCueValidator),
    timeRemaining: v.optional(v.array(timeRemainingCueValidator)),
  }),
);
