import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useClassDeletionJobs } from "@/hooks/classes/useClassDeletionJobs";
import { useRetryClassDeletion } from "@/hooks/classes/useRetryClassDeletion";

function isActiveJob(status: "queued" | "running" | "completed" | "failed"): boolean {
  return status === "queued" || status === "running";
}

export function ClassDeletionToastTracker() {
  const { t } = useTranslation("classes");
  const { data: jobs = [] } = useClassDeletionJobs();
  const retryDeletion = useRetryClassDeletion();
  const toastIdsRef = useRef(new Map<string, string>());
  const dismissedRef = useRef(new Set<string>());

  useEffect(() => {
    const seen = new Set<string>();

    for (const job of jobs) {
      seen.add(job._id);
      if (dismissedRef.current.has(job._id)) {
        continue;
      }

      const stageLabel = t(`deleteStage_${job.currentStage}`, {
        defaultValue: t("deleteStageUnknown"),
      });
      const pending = isActiveJob(job.status);
      const existingId = toastIdsRef.current.get(job._id);

      if (job.status === "failed") {
        const title = t("deleteFailedTitle", { name: job.className });
        const description = job.errorMessage ?? t("deleteFailed");
        if (existingId) {
          toast.update(existingId, {
            type: "error",
            title,
            description,
            timeout: 0,
            data: {
              extraActions: [
                {
                  label: t("deleteRetry"),
                  onClick: () => {
                    void retryDeletion.mutateAsync({ jobId: job._id });
                  },
                },
              ],
            },
          });
        } else {
          const id = toast.add({
            type: "error",
            title,
            description,
            timeout: 0,
            data: {
              extraActions: [
                {
                  label: t("deleteRetry"),
                  onClick: () => {
                    void retryDeletion.mutateAsync({ jobId: job._id });
                  },
                },
              ],
            },
          });
          toastIdsRef.current.set(job._id, id);
        }
        continue;
      }

      if (job.status === "completed") {
        const progress = 100;
        if (existingId) {
          toast.update(existingId, {
            type: "loading",
            title: t("deleteInProgressTitle", { name: job.className }),
            description: stageLabel,
            timeout: 2500,
            data: {
              classDeletion: {
                progress,
                pending: false,
                label: t("deleteComplete"),
              },
            },
          });
          window.setTimeout(() => {
            toast.close(existingId);
            toastIdsRef.current.delete(job._id);
            dismissedRef.current.add(job._id);
          }, 2500);
        }
        continue;
      }

      const progress = pending ? Math.max(job.progressPercent, 1) : job.progressPercent;
      const payload = {
        type: "loading" as const,
        title: t("deleteInProgressTitle", { name: job.className }),
        description: stageLabel,
        timeout: 0,
        data: {
          classDeletion: {
            progress,
            pending: true,
            label: `${progress}%`,
          },
        },
      };

      if (existingId) {
        toast.update(existingId, payload);
      } else {
        const id = toast.add(payload);
        toastIdsRef.current.set(job._id, id);
      }
    }

    for (const [jobId, toastId] of toastIdsRef.current.entries()) {
      if (!seen.has(jobId as Id<"classDeletionJobs">)) {
        toast.close(toastId);
        toastIdsRef.current.delete(jobId);
      }
    }
  }, [jobs, retryDeletion, t]);

  return null;
}
