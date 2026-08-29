import {
  DEFAULT_BUILTIN_AUDIO,
  builtinAudioId,
  builtinAudioI18nKey,
  type BuiltinAudioI18nKey,
} from "@/lib/classroomScreen/defaultAudio";
import type { ClassroomAudioFile } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import type { AudioFileOption } from "@/components/classroomScreen/AudioCueSelect";

export function toAudioUrlList(files: ClassroomAudioFile[]) {
  return files.map((file) => ({
    id: file._id,
    url: file.url,
  }));
}

export function getAllAudioOptions(
  files: ClassroomAudioFile[],
  translateBuiltin: (key: BuiltinAudioI18nKey) => string,
): AudioFileOption[] {
  const builtins: AudioFileOption[] = DEFAULT_BUILTIN_AUDIO.map((entry) => {
    const i18nKey = builtinAudioI18nKey(entry.key);
    return {
      id: builtinAudioId(entry.key),
      name: i18nKey ? translateBuiltin(i18nKey) : entry.name,
      isBuiltin: true,
    };
  });
  const uploads: AudioFileOption[] = files.map((file) => ({
    id: file._id,
    name: file.name,
    isBuiltin: false,
  }));
  return [...builtins, ...uploads];
}
