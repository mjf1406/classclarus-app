import { useCallback, useEffect, useRef, useState } from "react";

import {
  BUILTIN_AUDIO_MAP,
  getBuiltinAudioUrl,
  isBuiltinAudioId,
} from "@/lib/classroomScreen/defaultAudio";

export type AudioUrlMap = Map<string, string>;

export type AudioFileWithUrl = {
  id: string;
  url: string | null;
};

export function createAudioUrlMap(files: AudioFileWithUrl[]): AudioUrlMap {
  const map = new Map<string, string>(BUILTIN_AUDIO_MAP);
  for (const file of files) {
    if (file.url) map.set(file.id, file.url);
  }
  return map;
}

export function resolveAudioUrl(
  audioId: string | null | undefined,
  urlMap: AudioUrlMap,
): string | null {
  if (!audioId) return null;
  if (isBuiltinAudioId(audioId)) {
    return getBuiltinAudioUrl(audioId) ?? urlMap.get(audioId) ?? null;
  }
  return urlMap.get(audioId) ?? null;
}

async function safePlay(audio: HTMLAudioElement): Promise<boolean> {
  try {
    await audio.play();
    return true;
  } catch (error) {
    console.warn("Audio playback failed:", audio.src, error);
    return false;
  }
}

export function useAudioPlayer(urlMap: AudioUrlMap) {
  const cacheRef = useRef(new Map<string, HTMLAudioElement>());
  const queueRef = useRef(Promise.resolve());
  const playbackGenRef = useRef(0);
  const sessionPausedRef = useRef(false);
  const resumeSnapshotRef = useRef<HTMLAudioElement[]>([]);
  const endWaitCancelsRef = useRef(new Set<() => void>());
  const unlockedRef = useRef(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const loopAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const audio of cache.values()) {
        audio.pause();
        audio.src = "";
      }
      cache.clear();
      loopAudioRef.current = null;
    };
  }, []);

  const unlock = useCallback(() => {
    unlockedRef.current = true;
  }, []);

  const getAudio = useCallback((url: string, loop = false) => {
    const cache = cacheRef.current;
    const key = loop ? `loop:${url}` : url;
    let audio = cache.get(key);
    if (!audio) {
      audio = new Audio(url);
      cache.set(key, audio);
    } else if (audio.error) {
      audio.load();
    }
    return audio;
  }, []);

  const stopPlayDuring = useCallback(() => {
    const audio = loopAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    loopAudioRef.current = null;
  }, []);

  const cancelEndWaits = useCallback(() => {
    for (const cancel of endWaitCancelsRef.current) cancel();
    endWaitCancelsRef.current.clear();
  }, []);

  const stopAll = useCallback(() => {
    playbackGenRef.current += 1;
    sessionPausedRef.current = false;
    resumeSnapshotRef.current = [];
    cancelEndWaits();
    stopPlayDuring();
    for (const audio of cacheRef.current.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    queueRef.current = Promise.resolve();
  }, [stopPlayDuring, cancelEndWaits]);

  const pauseAll = useCallback(() => {
    sessionPausedRef.current = true;
    playbackGenRef.current += 1;
    cancelEndWaits();
    queueRef.current = Promise.resolve();

    const playing: HTMLAudioElement[] = [];
    for (const audio of cacheRef.current.values()) {
      if (!audio.paused) {
        playing.push(audio);
        audio.pause();
      }
    }
    resumeSnapshotRef.current = playing;
  }, [cancelEndWaits]);

  const resumeAll = useCallback(() => {
    sessionPausedRef.current = false;
    if (unlockedRef.current) {
      for (const audio of resumeSnapshotRef.current) {
        void safePlay(audio);
      }
    }
    resumeSnapshotRef.current = [];
  }, []);

  const startPlayDuring = useCallback(
    (audioId: string | null | undefined) => {
      stopPlayDuring();
      if (!audioId) return;

      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;

      unlockedRef.current = true;
      const audio = getAudio(url, true);
      audio.loop = true;
      audio.currentTime = 0;
      loopAudioRef.current = audio;
      void safePlay(audio);
    },
    [urlMap, getAudio, stopPlayDuring],
  );

  const waitForAudioEnd = useCallback((audio: HTMLAudioElement) => {
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onEnded);
        endWaitCancelsRef.current.delete(cancel);
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const cancel = () => {
        cleanup();
        resolve();
      };
      endWaitCancelsRef.current.add(cancel);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onEnded);
    });
  }, []);

  const playUrl = useCallback(
    (url: string, repeat = 1, immediate = false, bypassPause = false) => {
      if (!unlockedRef.current) return;
      if (sessionPausedRef.current && !bypassPause) return;

      const gen = playbackGenRef.current;
      const run = async () => {
        for (let i = 0; i < repeat; i++) {
          if (gen !== playbackGenRef.current) return;
          if (sessionPausedRef.current && !bypassPause) return;

          const audio = getAudio(url);
          audio.currentTime = 0;
          try {
            const played = await safePlay(audio);
            if (!played) break;
            if (gen !== playbackGenRef.current) {
              audio.pause();
              audio.currentTime = 0;
              return;
            }
            await waitForAudioEnd(audio);
          } catch {
            break;
          }
        }
      };

      if (immediate) {
        void run();
      } else {
        queueRef.current = queueRef.current.then(run);
      }
    },
    [getAudio, waitForAudioEnd],
  );

  const playById = useCallback(
    (audioId: string | null | undefined, repeat = 1, immediate = false, bypassPause = false) => {
      if (!audioId) return;
      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;
      playUrl(url, repeat, immediate, bypassPause);
    },
    [urlMap, playUrl],
  );

  const preview = useCallback(
    (audioId: string | null | undefined) => {
      if (!audioId) return;
      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;
      unlockedRef.current = true;
      const audio = getAudio(url);
      audio.currentTime = 0;
      void safePlay(audio);
    },
    [urlMap, getAudio],
  );

  const togglePreview = useCallback(
    (audioId: string) => {
      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;

      unlockedRef.current = true;
      const audio = getAudio(url);

      if (previewPlayingId === audioId && !audio.paused) {
        audio.pause();
        setPreviewPlayingId(null);
        return;
      }

      for (const [cachedUrl, cachedAudio] of cacheRef.current) {
        if (cachedUrl !== url) {
          cachedAudio.pause();
        }
      }

      const playPreview = (fromStart: boolean) => {
        audio.addEventListener(
          "ended",
          () => {
            setPreviewPlayingId((current) => (current === audioId ? null : current));
          },
          { once: true },
        );
        if (fromStart) audio.currentTime = 0;
        void safePlay(audio);
        setPreviewPlayingId(audioId);
      };

      if (previewPlayingId === audioId && audio.paused) {
        playPreview(false);
        return;
      }

      playPreview(true);
    },
    [urlMap, getAudio, previewPlayingId],
  );

  return {
    playById,
    preview,
    togglePreview,
    previewPlayingId,
    startPlayDuring,
    stopPlayDuring,
    stopAll,
    pauseAll,
    resumeAll,
    unlock,
  };
}
