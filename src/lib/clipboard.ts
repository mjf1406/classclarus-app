/** Async Clipboard API needs a secure context (HTTPS or localhost). */

export function canUseAsyncClipboard(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

export function canReadAsyncClipboard(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.readText === "function"
  );
}

function copyTextFallback(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error("Copy failed");
  }
}

/** Copy text; falls back to execCommand on http:// LAN hosts. */
export async function copyText(text: string): Promise<void> {
  if (canUseAsyncClipboard()) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission / transient failure — try legacy path.
    }
  }
  copyTextFallback(text);
}

export async function readClipboardText(): Promise<string> {
  if (!canReadAsyncClipboard()) {
    throw new Error("Clipboard read unavailable");
  }
  return navigator.clipboard.readText();
}
