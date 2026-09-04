import { describe, expect, it, vi } from "vite-plus/test";

import {
  createAudioUrlMap,
  decodeAudioUrl,
  resolveAudioUrl,
  resumeAudioContext,
  unlockAudioPlayback,
  warmUpAudioElement,
} from "@/lib/classroomScreen/audioEngine";
import { builtinAudioId } from "@/lib/classroomScreen/defaultAudio";

function createMockAudio(options?: {
  paused?: boolean;
  play?: () => Promise<void>;
}): HTMLAudioElement {
  const play =
    options?.play ??
    vi.fn(async function play(this: { paused: boolean }) {
      this.paused = false;
    });

  return {
    src: "/audio/game-over.mp3",
    paused: options?.paused ?? true,
    volume: 1,
    currentTime: 12,
    play,
    pause: vi.fn(function pause(this: { paused: boolean; currentTime: number }) {
      this.paused = true;
    }),
  } as unknown as HTMLAudioElement;
}

describe("createAudioUrlMap / resolveAudioUrl", () => {
  it("includes built-in files and uploaded URLs", () => {
    const map = createAudioUrlMap([{ id: "upload-1", url: "https://files.example/a.mp3" }]);

    expect(resolveAudioUrl(builtinAudioId("game-over"), map)).toBe("/audio/game-over.mp3");
    expect(resolveAudioUrl("upload-1", map)).toBe("https://files.example/a.mp3");
    expect(resolveAudioUrl("missing", map)).toBeNull();
  });
});

describe("warmUpAudioElement", () => {
  it("plays then pauses and resets so delayed cues can start later", async () => {
    const audio = createMockAudio();

    await warmUpAudioElement(audio);

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(true);
    expect(audio.volume).toBe(1);
  });

  it("does not interrupt audio that is already playing", async () => {
    const audio = createMockAudio({ paused: false });

    await warmUpAudioElement(audio);

    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(12);
    expect(audio.volume).toBe(1);
  });

  it("swallows a rejected play() so unlock never rejects", async () => {
    const audio = createMockAudio({
      play: vi.fn(() => Promise.reject(new DOMException("NotAllowedError"))),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(warmUpAudioElement(audio)).resolves.toBeUndefined();

    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.volume).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("unlockAudioPlayback", () => {
  it("warms each unique URL once and skips empty values", async () => {
    const created: string[] = [];
    const getAudio = vi.fn((url: string) => {
      created.push(url);
      return createMockAudio();
    });

    unlockAudioPlayback(["/audio/a.mp3", "", "/audio/a.mp3", "/audio/b.mp3"], getAudio);

    expect(getAudio).toHaveBeenCalledTimes(2);
    expect(created).toEqual(["/audio/a.mp3", "/audio/b.mp3"]);
    expect(getAudio.mock.results[0]?.value.play).toHaveBeenCalledOnce();
    expect(getAudio.mock.results[1]?.value.play).toHaveBeenCalledOnce();

    await Promise.resolve();
    expect(getAudio.mock.results[0]?.value.pause).toHaveBeenCalledOnce();
    expect(getAudio.mock.results[1]?.value.pause).toHaveBeenCalledOnce();
  });
});

describe("resumeAudioContext", () => {
  it("resumes a suspended context so delayed cues can start later", async () => {
    const resume = vi.fn(async () => undefined);
    const ctx = { state: "suspended", resume } as unknown as AudioContext;

    await resumeAudioContext(ctx);

    expect(resume).toHaveBeenCalledOnce();
  });

  it("skips resume when the context is already running", async () => {
    const resume = vi.fn(async () => undefined);
    const ctx = { state: "running", resume } as unknown as AudioContext;

    await resumeAudioContext(ctx);

    expect(resume).not.toHaveBeenCalled();
  });

  it("swallows a rejected resume() so unlock never rejects", async () => {
    const resume = vi.fn(() => Promise.reject(new DOMException("NotAllowedError")));
    const ctx = { state: "suspended", resume } as unknown as AudioContext;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(resumeAudioContext(ctx)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("decodeAudioUrl", () => {
  it("decodes fetched bytes into an audio buffer", async () => {
    const bytes = new ArrayBuffer(8);
    const buffer = { duration: 1 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => buffer);
    const ctx = { decodeAudioData } as unknown as AudioContext;
    const fetchImpl = vi.fn(async () => new Response(bytes, { status: 200 }));

    await expect(decodeAudioUrl(ctx, "/audio/game-over.mp3", fetchImpl)).resolves.toBe(buffer);
    expect(fetchImpl).toHaveBeenCalledWith("/audio/game-over.mp3");
    expect(decodeAudioData).toHaveBeenCalledOnce();
  });

  it("returns null when fetch fails so HTMLAudio can fall back", async () => {
    const decodeAudioData = vi.fn();
    const ctx = { decodeAudioData } as unknown as AudioContext;
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(decodeAudioUrl(ctx, "/audio/missing.mp3", fetchImpl)).resolves.toBeNull();

    expect(decodeAudioData).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
