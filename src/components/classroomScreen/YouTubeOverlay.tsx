import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  buildEmbedUrl,
  VIDEO_SIZE_WIDTH,
  type VideoPosition,
} from "@/lib/classroomScreen/audioCues";
import type { ResolvedVideoCue } from "@/lib/classroomScreen/audioCues";

interface YouTubeOverlayProps {
  video: ResolvedVideoCue;
  segmentKey: string;
  paused: boolean;
}

const POSITION_CLASSES: Record<VideoPosition, string> = {
  top: "top-4 left-1/2 -translate-x-1/2",
  bottom: "bottom-4 left-1/2 -translate-x-1/2",
  left: "left-4 top-1/2 -translate-y-1/2",
  right: "right-4 top-1/2 -translate-y-1/2",
};

function postPlayerCommand(iframe: HTMLIFrameElement | null, func: "pauseVideo" | "playVideo") {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

export function YouTubeOverlay({ video, segmentKey, paused }: YouTubeOverlayProps) {
  const { t } = useTranslation("classroomScreen");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    postPlayerCommand(iframeRef.current, paused ? "pauseVideo" : "playVideo");
  }, [paused]);

  if (!video.youtubeId) return null;

  const width = VIDEO_SIZE_WIDTH[video.size];
  const height = Math.round((width * 9) / 16);
  const embedUrl = buildEmbedUrl({
    id: video.youtubeId,
    muted: video.muted,
    loop: true,
  });

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-[5] overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10",
        POSITION_CLASSES[video.position],
      )}
      style={{ width, height }}
    >
      <iframe
        key={`${segmentKey}-${video.youtubeId}`}
        ref={iframeRef}
        src={embedUrl}
        title={t("videoPreviewTitle")}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
