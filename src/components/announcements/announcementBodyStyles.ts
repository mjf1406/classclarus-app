import { cn } from "@/lib/utils";

/** Shared prose styles for TipTap editor and read-only body. */
export function announcementBodyClassName(className?: string) {
  return cn(
    "announcement-body max-w-none text-sm leading-relaxed text-foreground",
    "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
    "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight",
    "[&_p]:my-2 [&_p]:min-h-[1.25em]",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
    "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
    "[&_li]:my-0.5",
    "[&_strong]:font-semibold",
    "[&_em]:italic",
    "[&_u]:underline",
    "[&_a.announcement-link]:inline-flex [&_a.announcement-link]:items-center [&_a.announcement-link]:gap-1",
    "[&_.is-editor-empty:first-child]::before:pointer-events-none [&_.is-editor-empty:first-child]::before:float-left [&_.is-editor-empty:first-child]::before:h-0 [&_.is-editor-empty:first-child]::before:text-muted-foreground [&_.is-editor-empty:first-child]::before:content-[attr(data-placeholder)]",
    className,
  );
}
