import { Apple, ChevronDown } from "lucide-react";
import type { SVGProps } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTrackDesktopDownload } from "@/hooks/billing/useTrackDesktopDownload";
import { DESKTOP_DOWNLOADS } from "@/lib/desktopDownloads";
import type { DesktopOs } from "../../../convex/lib/usageTracking";

function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13L10.5 19.6v-7.1H3v6zm8.2 1.2L21 21V12.5h-9.8v7.2ZM12.2 11.5H21V3l-8.8 1.2v7.3Z" />
    </svg>
  );
}

function UbuntuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.8a8.2 8.2 0 0 1 5.7 2.3l-1.4 1.4A6.2 6.2 0 0 0 12 5.6c-.7 0-1.4.1-2 .4L9.2 4.4A8.2 8.2 0 0 1 12 3.8Zm-7.4 5.3 1.7.7A6.2 6.2 0 0 0 5.8 12c0 .9.2 1.7.5 2.4l-1.7.7A8.2 8.2 0 0 1 4.6 9.1Zm3.5 8.4 1.1-1.5c.8.6 1.8 1 2.8 1 .9 0 1.8-.3 2.5-.8l1.2 1.5A8.2 8.2 0 0 1 12 20.2a8.2 8.2 0 0 1-5-1.7Zm11.7-3.4-1.7-.7c.3-.7.5-1.5.5-2.4s-.2-1.7-.5-2.4l1.7-.7a8.2 8.2 0 0 1 0 6.2ZM9.5 12a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" />
    </svg>
  );
}

export function FreeDownloadMenu() {
  const { t } = useTranslation("billing");
  const trackDownload = useTrackDesktopDownload();

  const onDownload = (os: DesktopOs) => {
    trackDownload.mutate({ os });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="default" size="sm" className="w-full justify-center gap-1.5" />}
      >
        {t("freeDownload")}
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuItem
          render={<a href={DESKTOP_DOWNLOADS.windows} target="_blank" rel="noreferrer" />}
          onClick={() => {
            onDownload("windows");
          }}
        >
          <WindowsIcon />
          {t("freeDownloadWindows")}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={DESKTOP_DOWNLOADS.mac} target="_blank" rel="noreferrer" />}
          onClick={() => {
            onDownload("mac");
          }}
        >
          <Apple />
          {t("freeDownloadMac")}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={DESKTOP_DOWNLOADS.ubuntu} target="_blank" rel="noreferrer" />}
          onClick={() => {
            onDownload("ubuntu");
          }}
        >
          <UbuntuIcon />
          {t("freeDownloadUbuntu")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
