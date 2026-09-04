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

/**
 * Play-then-pause during a user gesture so later HTMLAudio fallback
 * can start outside that gesture. Volume is zeroed so the warm-up is inaudible.
 */
export async function warmUpAudioElement(audio: HTMLAudioElement): Promise<void> {
  if (!audio.paused) return;

  const previousVolume = audio.volume;
  audio.volume = 0;
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {
    console.warn("Audio unlock failed:", audio.src, error);
  } finally {
    audio.volume = previousVolume;
  }
}

export function unlockAudioPlayback(
  urls: Iterable<string>,
  getAudio: (url: string) => HTMLAudioElement,
): void {
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    void warmUpAudioElement(getAudio(url));
  }
}

export async function resumeAudioContext(ctx: AudioContext): Promise<void> {
  if (ctx.state !== "suspended") return;
  try {
    await ctx.resume();
  } catch (error) {
    console.warn("Audio context resume failed:", error);
  }
}

export async function decodeAudioUrl(
  ctx: AudioContext,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    return await ctx.decodeAudioData(data.slice(0));
  } catch (error) {
    console.warn("Audio decode failed:", url, error);
    return null;
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
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const bufferLoadsRef = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const webSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const loopSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const loopBufferRef = useRef<AudioBuffer | null>(null);
  const loopStartedAtRef = useRef(0);
  const loopOffsetRef = useRef(0);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const loadBuffer = useCallback(
    (url: string) => {
      const cached = buffersRef.current.get(url);
      if (cached) return Promise.resolve(cached);

      const pending = bufferLoadsRef.current.get(url);
      if (pending) return pending;

      const load = decodeAudioUrl(getCtx(), url).then((buffer) => {
        if (buffer) buffersRef.current.set(url, buffer);
        return buffer;
      });
      bufferLoadsRef.current.set(url, load);
      return load;
    },
    [getCtx],
  );

  useEffect(() => {
    const cache = cacheRef.current;
    const sources = webSourcesRef.current;
    return () => {
      for (const audio of cache.values()) {
        audio.pause();
        audio.src = "";
      }
      cache.clear();
      loopAudioRef.current = null;
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }
      sources.clear();
      loopSourceRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
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

  const unlock = useCallback(() => {
    unlockedRef.current = true;
    void resumeAudioContext(getCtx());
    for (const url of urlMap.values()) {
      if (url) void loadBuffer(url);
    }
    unlockAudioPlayback(urlMap.values(), getAudio);
  }, [urlMap, getAudio, getCtx, loadBuffer]);

  const stopPlayDuring = useCallback(() => {
    const source = loopSourceRef.current;
    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      webSourcesRef.current.delete(source);
      loopSourceRef.current = null;
    }
    loopBufferRef.current = null;
    loopOffsetRef.current = 0;
    loopStartedAtRef.current = 0;

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

  const stopWebSources = useCallback(() => {
    for (const source of webSourcesRef.current) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    webSourcesRef.current.clear();
  }, []);

  const stopAll = useCallback(() => {
    playbackGenRef.current += 1;
    sessionPausedRef.current = false;
    resumeSnapshotRef.current = [];
    cancelEndWaits();
    stopPlayDuring();
    stopWebSources();
    for (const audio of cacheRef.current.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    queueRef.current = Promise.resolve();
  }, [stopPlayDuring, cancelEndWaits, stopWebSources]);

  const pauseAll = useCallback(() => {
    sessionPausedRef.current = true;
    playbackGenRef.current += 1;
    cancelEndWaits();
    queueRef.current = Promise.resolve();

    const loopSource = loopSourceRef.current;
    const loopBuffer = loopBufferRef.current;
    if (loopSource && loopBuffer && ctxRef.current) {
      loopOffsetRef.current =
        (loopOffsetRef.current + ctxRef.current.currentTime - loopStartedAtRef.current) %
        loopBuffer.duration;
      try {
        loopSource.stop();
      } catch {
        /* already stopped */
      }
      webSourcesRef.current.delete(loopSource);
      loopSourceRef.current = null;
    }

    stopWebSources();

    const playing: HTMLAudioElement[] = [];
    for (const audio of cacheRef.current.values()) {
      if (!audio.paused) {
        playing.push(audio);
        audio.pause();
      }
    }
    resumeSnapshotRef.current = playing;
  }, [cancelEndWaits, stopWebSources]);

  const startLoopBuffer = useCallback(
    (buffer: AudioBuffer, offset: number) => {
      const ctx = getCtx();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(ctx.destination);
      loopSourceRef.current = source;
      loopBufferRef.current = buffer;
      loopOffsetRef.current = offset;
      loopStartedAtRef.current = ctx.currentTime;
      webSourcesRef.current.add(source);
      source.start(0, offset);
    },
    [getCtx],
  );

  const resumeAll = useCallback(() => {
    sessionPausedRef.current = false;
    if (!unlockedRef.current) return;

    const loopBuffer = loopBufferRef.current;
    if (loopBuffer && !loopSourceRef.current) {
      startLoopBuffer(loopBuffer, loopOffsetRef.current);
    }

    for (const audio of resumeSnapshotRef.current) {
      void safePlay(audio);
    }
    resumeSnapshotRef.current = [];
  }, [startLoopBuffer]);

  const startPlayDuring = useCallback(
    (audioId: string | null | undefined) => {
      stopPlayDuring();
      if (!audioId) return;

      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;

      unlockedRef.current = true;
      void resumeAudioContext(getCtx());
      void loadBuffer(url).then((buffer) => {
        if (!buffer) {
          const audio = getAudio(url, true);
          audio.loop = true;
          audio.currentTime = 0;
          loopAudioRef.current = audio;
          void safePlay(audio);
          return;
        }
        startLoopBuffer(buffer, 0);
      });
    },
    [urlMap, getAudio, stopPlayDuring, getCtx, loadBuffer, startLoopBuffer],
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

  const playBufferUntilEnd = useCallback(
    (buffer: AudioBuffer) => {
      return new Promise<void>((resolve) => {
        const ctx = getCtx();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        webSourcesRef.current.add(source);

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          webSourcesRef.current.delete(source);
          endWaitCancelsRef.current.delete(cancel);
          resolve();
        };
        const cancel = () => {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
          finish();
        };
        source.onended = finish;
        endWaitCancelsRef.current.add(cancel);
        source.start();
      });
    },
    [getCtx],
  );

  const playUrl = useCallback(
    (url: string, repeat = 1, immediate = false, bypassPause = false) => {
      if (!unlockedRef.current) return;
      if (sessionPausedRef.current && !bypassPause) return;

      const gen = playbackGenRef.current;
      const run = async () => {
        const buffer = await loadBuffer(url);
        for (let i = 0; i < repeat; i++) {
          if (gen !== playbackGenRef.current) return;
          if (sessionPausedRef.current && !bypassPause) return;

          if (buffer) {
            await playBufferUntilEnd(buffer);
            continue;
          }

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
    [getAudio, waitForAudioEnd, loadBuffer, playBufferUntilEnd],
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
      void resumeAudioContext(getCtx());
      void loadBuffer(url);
      const audio = getAudio(url);
      audio.currentTime = 0;
      void safePlay(audio);
    },
    [urlMap, getAudio, getCtx, loadBuffer],
  );

  const togglePreview = useCallback(
    (audioId: string) => {
      const url = resolveAudioUrl(audioId, urlMap);
      if (!url) return;

      unlockedRef.current = true;
      void resumeAudioContext(getCtx());
      void loadBuffer(url);
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
    [urlMap, getAudio, previewPlayingId, getCtx, loadBuffer],
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
