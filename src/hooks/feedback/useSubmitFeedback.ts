import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { messageFromError } from "@/lib/errors/convexError";
import type {
  FeedbackType,
  FeedbackImportance,
  FeedbackSeverity,
} from "@/lib/feedback/feedbackFormSchema";

export type SubmitFeedbackArgs = {
  type: FeedbackType;
  title: string;
  body: string;
  stepsToReproduce?: string;
  expected?: string;
  actual?: string;
  severity?: FeedbackSeverity;
  useCase?: string;
  proposedSolution?: string;
  importance?: FeedbackImportance;
  impact?: string;
  wantReply: boolean;
  attachmentFileIds: Id<"files">[];
};

/** Fire-and-forget submit — no optimistic list for the submitter. */
export function useSubmitFeedback() {
  const { t } = useTranslation("feedback");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.feedback.submit);

  return useMutation({
    mutationFn: (args: SubmitFeedbackArgs) => mutationFn(args),
    retry: false,
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("submitFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
