export type BuiltinAudioEntry = {
  key: string;
  name: string;
  url: string;
};

export const DEFAULT_BUILTIN_AUDIO: BuiltinAudioEntry[] = [
  { key: "jeopardy", name: "Jeopardy", url: "/audio/30s-jeopardy-song.mp3" },
  { key: "10s-calm-alarm", name: "10s calm alarm", url: "/audio/10s-calm-alarm.mp3" },
  { key: "1-minute-warning", name: "1 minute warning", url: "/audio/1-minute-warning.mp3" },
  { key: "3-minute-warning", name: "3 minute warning", url: "/audio/3-minutes-warning.mp3" },
  {
    key: "4s-magical-surprise",
    name: "4s magical surprise",
    url: "/audio/4s-magical-surprise.mp3",
  },
  { key: "game-over", name: "Game over", url: "/audio/game-over.mp3" },
];

export const BUILTIN_AUDIO_I18N_KEYS = {
  jeopardy: "audioBuiltinJeopardy",
  "10s-calm-alarm": "audioBuiltin10sCalmAlarm",
  "1-minute-warning": "audioBuiltin1MinuteWarning",
  "3-minute-warning": "audioBuiltin3MinuteWarning",
  "4s-magical-surprise": "audioBuiltin4sMagicalSurprise",
  "game-over": "audioBuiltinGameOver",
} as const;

export type BuiltinAudioI18nKey =
  (typeof BUILTIN_AUDIO_I18N_KEYS)[keyof typeof BUILTIN_AUDIO_I18N_KEYS];

export function builtinAudioI18nKey(key: string): BuiltinAudioI18nKey | null {
  if (key in BUILTIN_AUDIO_I18N_KEYS) {
    return BUILTIN_AUDIO_I18N_KEYS[key as keyof typeof BUILTIN_AUDIO_I18N_KEYS];
  }
  return null;
}

export const BUILTIN_AUDIO_PREFIX = "builtin:";

export function builtinAudioId(key: string): string {
  return `${BUILTIN_AUDIO_PREFIX}${key}`;
}

export function isBuiltinAudioId(id: string): boolean {
  return id.startsWith(BUILTIN_AUDIO_PREFIX);
}

export function getBuiltinAudioUrl(id: string): string | null {
  if (!isBuiltinAudioId(id)) return null;
  const key = id.slice(BUILTIN_AUDIO_PREFIX.length);
  const entry = DEFAULT_BUILTIN_AUDIO.find((b) => b.key === key);
  return entry?.url ?? null;
}

export const BUILTIN_AUDIO_MAP = new Map(
  DEFAULT_BUILTIN_AUDIO.map((entry) => [builtinAudioId(entry.key), entry.url]),
);
