import { type AudioCues, resolveAudioCues, type ResolvedAudioCues } from "./audioCues.js";
import { secondsUntilEndTime } from "./timerUtils.js";

export type SegmentKind = "timer";

export type Segment = {
  kind: SegmentKind;
  label: string;
  durationSeconds: number;
  bgColor: string;
  audioCues: ResolvedAudioCues;
  endTime?: string;
};

export type ActiveSession = {
  name: string;
  segments: Segment[];
  index: number;
  bgTransition?: string;
  audioCues: ResolvedAudioCues;
};

export type TimerEndBehavior = "countUp" | "hold" | "return";

export type TimerDoc = {
  _id: string;
  name: string;
  durationSeconds: number;
  bgColor: string;
  endTime?: string;
  bgTransition?: string;
  audioCues?: AudioCues;
  nextTimerId?: string;
};

export function getCurrentSegment(session: ActiveSession): Segment {
  return session.segments[session.index]!;
}

export function getCurrentBgColor(session: ActiveSession | null, clockBgColor: string): string {
  if (!session) return clockBgColor;
  return getCurrentSegment(session).bgColor;
}

function buildSegment(
  kind: SegmentKind,
  label: string,
  durationSeconds: number,
  bgColor: string,
  endTime?: string,
  ...cueLayers: (AudioCues | undefined)[]
): Segment {
  return {
    kind,
    label,
    durationSeconds,
    bgColor,
    endTime,
    audioCues: resolveAudioCues(...cueLayers),
  };
}

export function resolveSegmentDuration(segment: Segment, nowMs = Date.now()): number {
  if (segment.endTime) {
    return secondsUntilEndTime(segment.endTime, nowMs);
  }
  return segment.durationSeconds;
}

export function buildTimerSegmentFromDoc(
  timer: TimerDoc,
  globalCues?: AudioCues,
  nowMs = Date.now(),
): Segment {
  const durationSeconds = timer.endTime
    ? secondsUntilEndTime(timer.endTime, nowMs)
    : timer.durationSeconds;

  return buildSegment(
    "timer",
    timer.name,
    durationSeconds,
    timer.bgColor,
    timer.endTime,
    timer.audioCues,
    globalCues,
  );
}

export function appendTimerToSession(
  session: ActiveSession,
  timer: TimerDoc,
  globalCues?: AudioCues,
  nowMs = Date.now(),
): ActiveSession {
  return {
    ...session,
    segments: [...session.segments, buildTimerSegmentFromDoc(timer, globalCues, nowMs)],
  };
}

export function buildTimerSession(
  durationSeconds: number,
  bgColor: string,
  name: string,
  globalCues: AudioCues | undefined,
  itemCues: AudioCues | undefined,
  bgTransition?: string,
): ActiveSession {
  const sessionCues = resolveAudioCues(itemCues, globalCues);
  return {
    name,
    segments: [
      buildSegment("timer", name, durationSeconds, bgColor, undefined, itemCues, globalCues),
    ],
    index: 0,
    bgTransition,
    audioCues: sessionCues,
  };
}

export function buildQuickPresetSession(
  durationSeconds: number,
  timerBgColor: string,
  globalCues?: AudioCues,
): ActiveSession {
  return buildTimerSession(durationSeconds, timerBgColor, "Quick timer", globalCues, undefined);
}

export function buildTimerChainSegments(
  startTimer: TimerDoc,
  allTimers: TimerDoc[],
  globalCues?: AudioCues,
  nowMs = Date.now(),
): Segment[] {
  const byId = new Map(allTimers.map((timer) => [timer._id, timer]));
  const segments: Segment[] = [];
  const visited = new Set<string>();
  let current: TimerDoc | undefined = startTimer;

  while (current && !visited.has(current._id)) {
    visited.add(current._id);
    segments.push(buildTimerSegmentFromDoc(current, globalCues, nowMs));
    if (!current.nextTimerId) break;
    const next = byId.get(current.nextTimerId);
    if (!next) break;
    current = next;
  }

  return segments;
}

export function buildCustomTimerSession(
  timer: TimerDoc,
  globalCues?: AudioCues,
  allTimers?: TimerDoc[],
  nowMs = Date.now(),
): ActiveSession {
  const segments =
    allTimers && allTimers.length > 0
      ? buildTimerChainSegments(timer, allTimers, globalCues, nowMs)
      : [buildTimerSegmentFromDoc(timer, globalCues, nowMs)];
  const sessionCues = resolveAudioCues(timer.audioCues, globalCues);

  return {
    name: timer.name,
    segments,
    index: 0,
    bgTransition: timer.bgTransition,
    audioCues: sessionCues,
  };
}

export function isLastSegment(session: ActiveSession): boolean {
  return session.index >= session.segments.length - 1;
}

export function hasUpcomingSegments(session: ActiveSession): boolean {
  return session.index < session.segments.length - 1;
}

export function truncateUpcomingSegments(session: ActiveSession): ActiveSession {
  return {
    ...session,
    segments: session.segments.slice(0, session.index + 1),
  };
}

export function advanceSegment(session: ActiveSession): ActiveSession | null {
  if (isLastSegment(session)) return null;
  return {
    ...session,
    index: session.index + 1,
  };
}

export function formatCountdown(totalSeconds: number): string {
  const isOvertime = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const time =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return isOvertime ? `+${time}` : time;
}

export function formatEndTimestamp(endMs: number, timeFormat: string, locale?: string): string {
  return new Date(endMs).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12h",
  });
}

export function formatWallTime(now: Date, timeFormat: string, locale?: string): string {
  return now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12h",
  });
}

export function parseSessionJson(json: unknown): ActiveSession | null {
  if (!json || typeof json !== "object") return null;
  const session = json as ActiveSession;
  if (!session.segments || !Array.isArray(session.segments)) return null;
  if (typeof session.index !== "number") return null;
  return session;
}

export function serializeSession(session: ActiveSession): ActiveSession {
  return JSON.parse(JSON.stringify(session)) as ActiveSession;
}

export function remainingFromDisplaySession(
  endsAt: number | null | undefined,
  paused: boolean,
  pausedRemainingMs: number | null | undefined,
  nowMs = Date.now(),
): number {
  if (paused) {
    return Math.floor((pausedRemainingMs ?? 0) / 1000);
  }
  if (endsAt == null) return 0;
  return Math.floor((endsAt - nowMs) / 1000);
}

export function isPushOverrideActive(
  pushedUntil: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (pushedUntil == null) return false;
  return pushedUntil > nowMs;
}

export function formatPushOverrideRemainingSeconds(
  pushedUntil: number,
  nowMs = Date.now(),
): number {
  return Math.max(0, Math.ceil((pushedUntil - nowMs) / 1000));
}

export function formatPushOverrideRemaining(pushedUntil: number, nowMs = Date.now()): string {
  const secondsLeft = formatPushOverrideRemainingSeconds(pushedUntil, nowMs);
  if (secondsLeft >= 60) {
    const minutes = Math.ceil(secondsLeft / 60);
    return `${minutes}m left`;
  }
  return `${secondsLeft}s left`;
}
