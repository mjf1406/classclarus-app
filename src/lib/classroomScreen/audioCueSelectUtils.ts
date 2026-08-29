import type { CueRef } from "@/lib/classroomScreen/audioCues";

export type AudioFileOption = {
  id: string;
  name: string;
  isBuiltin?: boolean;
};

export type CueSelectValue = "inherit" | "none" | string;

export function audioIdToSelectValue(
  audioId: CueRef | undefined,
  allowInherit: boolean,
): CueSelectValue {
  if (audioId === undefined) return allowInherit ? "inherit" : "none";
  if (audioId === "none") return "none";
  return audioId;
}

export function selectValueToAudioId(value: CueSelectValue): CueRef | undefined {
  if (value === "inherit") return undefined;
  if (value === "none") return "none";
  return value;
}
