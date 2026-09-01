import { type AudioCues, resolveAudioCues, type ResolvedAudioCues } from "./audioCues.js";
import { secondsUntilEndTime } from "./timerUtils.js";

export type SegmentKind = "timer" | "work" | "transition";

export type Segment = {
  kind: SegmentKind;
  label: string;
  durationSeconds: number;
  bgColor: string;
  audioCues: ResolvedAudioCues;
  endTime?: string;
  round?: number;
  roundCount?: number;
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

export type RotationDoc = {
  name: string;
  rotationDurationSeconds: number;
  numberOfRotations: number;
  transitionDurationSeconds: number;
  rotationBgColor: string;
  transitionBgColor: string;
  finalTransition?: boolean;
  bgTransition?: string;
  audioCues?: AudioCues;
  workCues?: AudioCues;
  transitionCues?: AudioCues;
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

export function resolveSegmentDuration(
  segment: Segment,
  timeZone: string,
  nowMs = Date.now(),
): number {
  if (segment.endTime) {
    return secondsUntilEndTime(segment.endTime, timeZone, nowMs);
  }
  return segment.durationSeconds;
}

export function buildTimerSegmentFromDoc(
  timer: TimerDoc,
  timeZone: string,
  globalCues?: AudioCues,
  nowMs = Date.now(),
): Segment {
  const durationSeconds = timer.endTime
    ? secondsUntilEndTime(timer.endTime, timeZone, nowMs)
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
  timeZone: string,
  globalCues?: AudioCues,
  nowMs = Date.now(),
): ActiveSession {
  return {
    ...session,
    segments: [...session.segments, buildTimerSegmentFromDoc(timer, timeZone, globalCues, nowMs)],
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
  timeZone: string,
  globalCues?: AudioCues,
  nowMs = Date.now(),
): Segment[] {
  const byId = new Map(allTimers.map((timer) => [timer._id, timer]));
  const segments: Segment[] = [];
  const visited = new Set<string>();
  let current: TimerDoc | undefined = startTimer;

  while (current && !visited.has(current._id)) {
    visited.add(current._id);
    segments.push(buildTimerSegmentFromDoc(current, timeZone, globalCues, nowMs));
    if (!current.nextTimerId) break;
    const next = byId.get(current.nextTimerId);
    if (!next) break;
    current = next;
  }

  return segments;
}

export function buildCustomTimerSession(
  timer: TimerDoc,
  timeZone: string,
  globalCues?: AudioCues,
  allTimers?: TimerDoc[],
  nowMs = Date.now(),
): ActiveSession {
  const segments =
    allTimers && allTimers.length > 0
      ? buildTimerChainSegments(timer, allTimers, timeZone, globalCues, nowMs)
      : [buildTimerSegmentFromDoc(timer, timeZone, globalCues, nowMs)];
  const sessionCues = resolveAudioCues(timer.audioCues, globalCues);

  return {
    name: timer.name,
    segments,
    index: 0,
    bgTransition: timer.bgTransition,
    audioCues: sessionCues,
  };
}

export function buildRotationSession(rotation: RotationDoc, globalCues?: AudioCues): ActiveSession {
  const segments: Segment[] = [];
  const transitionSeconds = rotation.transitionDurationSeconds;
  const finalTransition = rotation.finalTransition ?? false;
  const sessionCues = resolveAudioCues(rotation.audioCues, globalCues);

  for (let i = 1; i <= rotation.numberOfRotations; i++) {
    const workSegment = buildSegment(
      "work",
      `Rotation ${i} of ${rotation.numberOfRotations}`,
      rotation.rotationDurationSeconds,
      rotation.rotationBgColor,
      undefined,
      rotation.workCues,
      rotation.audioCues,
      globalCues,
    );
    workSegment.round = i;
    workSegment.roundCount = rotation.numberOfRotations;
    segments.push(workSegment);

    const isLastRotation = i === rotation.numberOfRotations;
    const shouldAddTransition = !isLastRotation || finalTransition;

    if (shouldAddTransition && transitionSeconds > 0) {
      segments.push(
        buildSegment(
          "transition",
          "Transition",
          transitionSeconds,
          rotation.transitionBgColor,
          undefined,
          rotation.transitionCues,
          rotation.audioCues,
          globalCues,
        ),
      );
    }
  }

  return {
    name: rotation.name,
    segments,
    index: 0,
    bgTransition: rotation.bgTransition,
    audioCues: sessionCues,
  };
}

export function isRotationSession(session: ActiveSession): boolean {
  return session.segments.some((segment) => segment.kind === "work");
}

export type RotationEndTime = {
  label: string;
  endMs: number;
  segmentIndex: number;
  isCurrent: boolean;
  round?: number;
  roundCount?: number;
};

export function getRotationEndTimes(
  session: ActiveSession,
  currentEndsAtMs: number,
): RotationEndTime[] {
  const segmentEndMs = new Array<number>(session.segments.length);
  segmentEndMs[session.index] = currentEndsAtMs;

  for (let i = session.index + 1; i < session.segments.length; i++) {
    segmentEndMs[i] = segmentEndMs[i - 1]! + session.segments[i]!.durationSeconds * 1000;
  }

  for (let i = session.index - 1; i >= 0; i--) {
    segmentEndMs[i] = segmentEndMs[i + 1]! - session.segments[i + 1]!.durationSeconds * 1000;
  }

  return session.segments.flatMap((segment, segmentIndex) => {
    if (segment.kind !== "work") return [];

    return [
      {
        label: segment.label,
        endMs: segmentEndMs[segmentIndex]!,
        segmentIndex,
        isCurrent: segmentIndex === session.index,
        round: segment.round,
        roundCount: segment.roundCount,
      },
    ];
  });
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
