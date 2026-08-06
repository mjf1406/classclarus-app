import { useConvexMutation } from "@convex-dev/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classFilesListQueryKey } from "@/hooks/files/useClassFiles";
import { fileBytesQueryKey } from "@/hooks/files/useFileBytes";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { removeById } from "@/lib/optimistic";

type ClassFilePublic = FunctionReturnType<typeof api.files.listClassFiles>[number];

type DeleteFileArgs = {
  fileId: Id<"files">;
  /** When set, optimistically removes the file from the class library list. */
  classId?: Id<"classes">;
};

export function useDeleteFile() {
  const { t } = useTranslation("upload");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.files.deleteFile);

  return useOptimisticMutation({
    mutationFn: (args: DeleteFileArgs) => mutationFn({ fileId: args.fileId }),
    queryKeys: (args) => {
      const keys: QueryKey[] = [fileBytesQueryKey(args.fileId)];
      if (args.classId !== undefined) {
        keys.push(classFilesListQueryKey(args.classId));
      }
      return keys;
    },
    applyOptimisticUpdate: (queryClient, args) => {
      if (args.classId === undefined) {
        return;
      }
      const listKey = classFilesListQueryKey(args.classId);
      queryClient.setQueryData<ClassFilePublic[]>(listKey, (old) =>
        old ? removeById(old, args.fileId) : old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("deleteFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
