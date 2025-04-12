import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoaderSmallInline() {
  const [dots, setDots] = useState("");

  // Cycle through the ellipsis: ".", "..", "..."
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500); // adjust speed if needed

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="flex items-center justify-start gap-1 font-bold">
        <Loader2 className="h-5 w-5 animate-spin" />
        {/* Wrap the text in a container with relative positioning */}
        <span className="loading-text relative inline-block overflow-hidden">
          Loading{dots}
        </span>
      </div>
      <style jsx>{`
        .loading-text {
          position: relative;
          /* Ensure the text is not clipped so the shimmer looks good */
        }
        .loading-text::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.7),
            transparent
          );
          /* The shimmer overlay will be semi-transparent */
          animation: shimmer 2s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
}
