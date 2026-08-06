import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaRegister } from "@/hooks/usePwaRegister";
import { isElectronClassroom } from "@/lib/classroom/classroomSession";
import { unregisterServiceWorkersAndCaches } from "@/lib/pwa/unregisterServiceWorkers";
import { cn } from "@/lib/utils";

export type PwaReloadBannerViewProps = {
  onReload: () => void;
  onLater: () => void;
  className?: string;
};

/**
 * Presentational PWA update banner (layout + copy).
 * Used by the live banner and the /ui playground.
 * Surface colors match info toast variants in toast.tsx.
 */
export function PwaReloadBannerView({ onReload, onLater, className }: PwaReloadBannerViewProps) {
  const { t } = useTranslation("common");

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "border-b border-cyan-600 bg-[color-mix(in_oklab,var(--background)_80%,var(--color-cyan-500)_20%)] px-4 py-3",
        "dark:border-cyan-400",
        className,
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 text-cyan-700 dark:text-cyan-400">
            <InfoIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium leading-tight">{t("pwaUpdateTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("pwaUpdateDescription")}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={onReload}>
            {t("pwaUpdateReload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onLater}
          >
            {t("pwaUpdateLater")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Live PWA update banner — only call usePwaRegister outside Electron. */
function PwaReloadBannerLive() {
  const { needRefresh, dismiss, reload } = usePwaRegister();

  if (!needRefresh) {
    return null;
  }

  return (
    <PwaReloadBannerView
      className="fixed inset-x-0 top-0 z-[100] pt-[max(0.75rem,env(safe-area-inset-top))]"
      onReload={reload}
      onLater={dismiss}
    />
  );
}

function PwaElectronCleanup() {
  useEffect(() => {
    void unregisterServiceWorkersAndCaches();
  }, []);
  return null;
}

/**
 * Root-mounted PWA chrome: skip Electron (unregister leftovers), register + prompt elsewhere.
 * Dev builds do not register a SW (vite-plugin-pwa stub when devOptions.enabled is false).
 */
export function PwaRoot() {
  if (!import.meta.env.PROD) {
    return null;
  }
  if (isElectronClassroom()) {
    return <PwaElectronCleanup />;
  }
  return <PwaReloadBannerLive />;
}
