import { useEffect, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInbox } from "@fortawesome/free-solid-svg-icons/faInbox";
import { useTranslation } from "react-i18next";
import { ClassRoleBadge } from "@/components/badges/ClassRoleBadges";
import { SelfHostUpdateBannerView } from "@/components/classroom/SelfHostUpdateBanner";
import { PwaReloadBannerView } from "@/components/pwa/PwaReloadBanner";
import { LanguageSelect } from "@/components/i18n/LanguageSelect";
import { FontAwesomeIconPickerLazy } from "@/components/icons/FontAwesomeIconPickerLazy";
import { iconDefinitionToId } from "@/components/icons/fontawesome-icon-catalog";
import { useTheme } from "@/components/theme/theme-context";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaTrigger,
} from "@/components/ui/credenza";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { OverflowTooltip } from "@/components/ui/overflow-tooltip";
import { ProgressButton } from "@/components/ui/progress-button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast-manager";
import { undoToast } from "@/components/ui/undo-toast";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useAppLanguage } from "@/i18n/language-context";

const CLASS_ROLES = [
  "owner",
  "teacher",
  "assistant_teacher",
  "student",
  "guardian",
  "unknown_role",
] as const;

/** Dev-only component playground. Not shipped in production builds. */
export function UiPlayground() {
  const { theme } = useTheme();
  const { language, setLanguage, isSaving } = useAppLanguage();
  const { t } = useTranslation("home");
  const { t: uploadT } = useTranslation("upload");
  const [icon, setIcon] = useState<IconDefinition | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [undoRestored, setUndoRestored] = useState(false);
  const [showPwaUpdateBanner, setShowPwaUpdateBanner] = useState(false);
  const pdfIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pdfIntervalRef.current !== null) {
        clearInterval(pdfIntervalRef.current);
      }
    };
  }, []);

  const simulatePdfGeneration = () => {
    if (pdfIntervalRef.current !== null) {
      clearInterval(pdfIntervalRef.current);
      pdfIntervalRef.current = null;
    }

    setPdfPending(true);
    setPdfProgress(0);

    pdfIntervalRef.current = setInterval(() => {
      setPdfProgress((current) => {
        const next = Math.min(100, current + 5);
        if (next >= 100) {
          if (pdfIntervalRef.current !== null) {
            clearInterval(pdfIntervalRef.current);
            pdfIntervalRef.current = null;
          }
          setTimeout(() => {
            setPdfPending(false);
            setPdfProgress(0);
          }, 300);
        }
        return next;
      });
    }, 80);
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-8">
      {showPwaUpdateBanner ? (
        <PwaReloadBannerView
          className="fixed inset-x-0 top-0 z-[100] pt-[max(0.75rem,env(safe-area-inset-top))]"
          onReload={() => {
            setShowPwaUpdateBanner(false);
            toast.add({
              title: "Reload",
              description: "Would call updateServiceWorker(true).",
              type: "info",
            });
          }}
          onLater={() => setShowPwaUpdateBanner(false)}
        />
      ) : null}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("language")}</h2>
        <LanguageSelect
          value={language}
          onValueChange={setLanguage}
          disabled={isSaving}
          triggerClassName="max-w-xs"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Self-host update banner</h2>
        <p className="text-sm text-muted-foreground">
          Preview of the Docker/web update advisory. Resize the window to check the stacked mobile
          layout.
        </p>
        <div className="overflow-hidden rounded-2xl border">
          <SelfHostUpdateBannerView
            className="border-b-0"
            currentVersion="0.1.10"
            availableVersion="0.1.11"
            onRemindLater={() =>
              toast.add({
                title: "Remind me later",
                description: "Would hide for this browser session.",
                type: "info",
              })
            }
            onDismiss={() =>
              toast.add({
                title: "Dismissed",
                description: "Would dismiss version 0.1.11 permanently.",
                type: "info",
              })
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">PWA reload banner</h2>
        <p className="text-sm text-muted-foreground">
          Same fixed top banner the app shows when a service-worker update is waiting. Real updates
          need <code className="text-xs">vp build &amp;&amp; vp preview</code>, not{" "}
          <code className="text-xs">vp dev</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPwaUpdateBanner(true)}
            disabled={showPwaUpdateBanner}
          >
            Show update banner
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border">
          <PwaReloadBannerView
            className="border-b-0"
            onReload={() =>
              toast.add({
                title: "Reload",
                description: "Would call updateServiceWorker(true).",
                type: "info",
              })
            }
            onLater={() =>
              toast.add({
                title: "Later",
                description: "Would hide for this browser session.",
                type: "info",
              })
            }
          />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-medium">{t("badges")}</h2>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("roleBadges")}</h3>
          <div className="flex flex-wrap gap-2">
            {CLASS_ROLES.map((role) => (
              <ClassRoleBadge key={role} role={role} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Base Badge variants</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Copy button</h2>
        <p className="text-sm text-muted-foreground">
          Inline success feedback for 750ms — no toast on copy.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton type="text" value="Hello from VCTR" />
          <CopyButton type="link" value="https://example.com" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Async & progress buttons</h2>
        <p className="text-sm text-muted-foreground">
          AsyncButton for Convex-style pending; ProgressButton for client-side jobs like PDF
          generation.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <AsyncButton
            onClick={() =>
              new Promise<void>((resolve) => {
                setTimeout(resolve, 1500);
              })
            }
          >
            Save (async)
          </AsyncButton>
          <AsyncButton variant="outline" pending>
            Always pending
          </AsyncButton>
          <ProgressButton
            pending={pdfPending}
            progress={pdfProgress}
            onClick={simulatePdfGeneration}
          >
            Download PDF
          </ProgressButton>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Toasts</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Success",
                description: "Something went well.",
                type: "success",
              })
            }
          >
            Success
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Error",
                description: "Something went wrong.",
                type: "error",
              })
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Warning",
                description: "Proceed with caution.",
                type: "warning",
              })
            }
          >
            Warning
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Info",
                description: "Here is some information.",
                type: "info",
              })
            }
          >
            Info
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Tip",
                description: "Try this helpful suggestion.",
                type: "tip",
              })
            }
          >
            Tip
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Loading",
                description: "Still working…",
                type: "loading",
              })
            }
          >
            Loading
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void toast.promise(
                new Promise<string>((resolve) => {
                  setTimeout(() => resolve("done"), 1500);
                }),
                {
                  loading: "Promise pending…",
                  success: "Promise resolved",
                  error: "Promise rejected",
                },
              );
            }}
          >
            Promise
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("errorState")}</h2>
          <p className="text-sm text-muted-foreground">{t("errorStateDescription")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Default</h3>
          <ErrorState />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Card + retry</h3>
          <ErrorState
            card
            onRetry={() =>
              new Promise<void>((resolve) => {
                setTimeout(resolve, 1200);
              })
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("overflowTooltip")}</h2>
        <p className="text-sm text-muted-foreground">{t("overflowTooltipDescription")}</p>
        <div className="flex flex-col gap-3">
          <div className="w-28 rounded-lg border border-border px-3 py-2">
            <OverflowTooltip>{t("overflowTooltipShort")}</OverflowTooltip>
          </div>
          <div className="w-40 rounded-lg border border-border px-3 py-2">
            <OverflowTooltip>{t("overflowTooltipLong")}</OverflowTooltip>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("undoToast")}</h2>
        <p className="text-sm text-muted-foreground">{t("undoToastDescription")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setUndoRestored(false);
              undoToast({
                title: t("undoToastTitle"),
                description: t("undoToastDescriptionBody"),
                onUndo: () => {
                  setUndoRestored(true);
                },
              });
            }}
          >
            {t("undoToastTrigger")}
          </Button>
          {undoRestored ? (
            <span className="text-sm text-muted-foreground">{t("undoToastRestored")}</span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Icon picker</h2>
        <div className="flex flex-wrap items-center gap-4">
          <FontAwesomeIconPickerLazy value={icon} onChange={setIcon} />
          {icon ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FontAwesomeIcon icon={icon} className="text-xl text-foreground" fixedWidth />
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {iconDefinitionToId(icon)}
              </code>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No icon selected</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Credenza</h2>
        <Credenza>
          <CredenzaTrigger render={<Button variant="outline" />}>Open credenza</CredenzaTrigger>
          <CredenzaContent>
            <CredenzaHeader>
              <CredenzaTitle>Credenza demo</CredenzaTitle>
              <CredenzaDescription>Dialog on desktop, drawer on mobile.</CredenzaDescription>
            </CredenzaHeader>
            <CredenzaBody>
              <p className="text-sm text-muted-foreground">
                Resize the viewport or use device mode to confirm the responsive switch.
              </p>
            </CredenzaBody>
            <CredenzaFooter>
              <CredenzaClose render={<Button />}>Done</CredenzaClose>
            </CredenzaFooter>
          </CredenzaContent>
        </Credenza>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-medium">Empty</h2>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Default (dashed)</h3>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FontAwesomeIcon icon={faInbox} />
              </EmptyMedia>
              <EmptyTitle>No data</EmptyTitle>
              <EmptyDescription>No data found</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button>Add data</Button>
            </EmptyContent>
          </Empty>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Card</h3>
          <Empty card>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FontAwesomeIcon icon={faInbox} />
              </EmptyMedia>
              <EmptyTitle>No data</EmptyTitle>
              <EmptyDescription>No data found</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button>Add data</Button>
            </EmptyContent>
          </Empty>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{uploadT("uploadDemoTitle")}</h2>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {uploadT("uploadDemoDefaultTitle")}
          </h3>
          <FileDropzone presetKey="images" variant="default" />
          <FileDropzone presetKey="documents" variant="default" />
          <FileDropzone presetKey="audio" variant="default" />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {uploadT("uploadDemoCompactTitle")}
          </h3>
          <Credenza>
            <CredenzaTrigger render={<Button variant="outline" />}>
              {uploadT("openUploadDialog")}
            </CredenzaTrigger>
            <CredenzaContent>
              <CredenzaHeader>
                <CredenzaTitle>{uploadT("uploadDemoCompactTitle")}</CredenzaTitle>
                <CredenzaDescription>{uploadT("uploadDemoCompactTitle")}</CredenzaDescription>
              </CredenzaHeader>
              <CredenzaBody>
                <FileDropzone presetKey="images" variant="compact" />
              </CredenzaBody>
              <CredenzaFooter>
                <CredenzaClose render={<Button />}>{uploadT("closeUploadDialog")}</CredenzaClose>
              </CredenzaFooter>
            </CredenzaContent>
          </Credenza>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Use the sun/moon control in the nav bar to switch theme. Current preference:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {theme}
          </code>
        </p>
      </section>

      <Spinner className="size-12" />
    </main>
  );
}
