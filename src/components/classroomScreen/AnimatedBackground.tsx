import { useEffect, useRef, useState } from "react";

import {
  BG_TRANSITION_MS,
  getOverlayStyle,
  type BgTransition,
} from "@/lib/classroomScreen/bgTransitions";

interface AnimatedBackgroundProps {
  color: string;
  transition: BgTransition;
}

export function AnimatedBackground({ color, transition }: AnimatedBackgroundProps) {
  const [baseColor, setBaseColor] = useState(color);
  const [overlay, setOverlay] = useState<{
    color: string;
    active: boolean;
  } | null>(null);
  const prevColorRef = useRef(color);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (color === prevColorRef.current) return;

    prevColorRef.current = color;

    if (transition === "instant") {
      setBaseColor(color);
      setOverlay(null);
      return;
    }

    setOverlay({ color, active: false });

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlay({ color, active: true });
      });
    });

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setBaseColor(color);
      setOverlay(null);
      timeoutRef.current = null;
    }, BG_TRANSITION_MS);

    return () => {
      cancelAnimationFrame(raf);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [color, transition]);

  return (
    <>
      <div className="absolute inset-0" style={{ backgroundColor: baseColor }} aria-hidden />
      {overlay && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: overlay.color,
            ...getOverlayStyle(transition, overlay.active),
          }}
          aria-hidden
        />
      )}
    </>
  );
}
