import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadFileItem } from "@/hooks/files/useUploadFiles";

type UploadQueueProps = {
  items: readonly UploadFileItem[];
  onAbort: (id: string) => void;
  onRetry: (id: string) => void;
};

export function UploadQueue({ items, onAbort, onRetry }: UploadQueueProps) {
  const { t } = useTranslation("upload");

  // Intentionally keep queue copy minimal for now; the follow-up todo will
  // introduce the `upload` i18n namespace with richer labels.
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const showAbort = item.status === "uploading";
        const showRetry = item.status === "error" || item.status === "aborted";

        return (
          <div key={item.id} className="rounded-lg border border-border/60 bg-background px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.file.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.status === "queued" && t("queued")}
                  {item.status === "uploading" && `${t("uploading")} (${item.progress}%)`}
                  {item.status === "done" && t("uploaded")}
                  {item.status === "aborted" && t("cancelled")}
                  {item.status === "error" &&
                    (item.errorCode === "invalid_type"
                      ? t("invalidType")
                      : item.errorCode === "invalid_size"
                        ? t("invalidSize")
                        : item.errorCode === "invalid_content"
                          ? t("invalidContent")
                          : item.errorCode === "quota_exceeded"
                            ? t("quotaExceeded")
                            : item.errorCode === "finalize_failed"
                              ? t("finalizeFailed")
                              : t("uploadFailed"))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showAbort && (
                  <Button variant="outline" size="sm" onClick={() => onAbort(item.id)}>
                    {t("abort")}
                  </Button>
                )}
                {showRetry && (
                  <Button variant="outline" size="sm" onClick={() => onRetry(item.id)}>
                    {t("retry")}
                  </Button>
                )}
              </div>
            </div>

            {item.status === "uploading" && (
              <div className="mt-3">
                <Progress value={item.progress} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
