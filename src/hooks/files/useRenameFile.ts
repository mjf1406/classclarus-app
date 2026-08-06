import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classFilesListQueryKey } from "@/hooks/files/useClassFiles";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type ClassFilePublic = FunctionReturnType<typeof api.files.listClassFiles>[number];

type RenameFileArgs = {
  fileId: Id<"files">;
  name: string;
  /** When set, optimistically renames the file in the class library list. */
  classId?: Id<"classes">;
};

export function useRenameFile() {
  const { t } = useTranslation("upload");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.files.renameFile);

  return useOptimisticMutation({
    mutationFn: (args: RenameFileArgs) => mutationFn({ fileId: args.fileId, name: args.name }),
    queryKeys: (args) => {
      if (args.classId !== undefined) {
        return [classFilesListQueryKey(args.classId)];
      }
      return [];
    },
    applyOptimisticUpdate: (queryClient, args) => {
      if (args.classId === undefined) {
        return;
      }
      const listKey = classFilesListQueryKey(args.classId);
      const name = args.name.trim().slice(0, 255) || "file";
      queryClient.setQueryData<ClassFilePublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((file) => (file._id === args.fileId ? { ...file, name } : file));
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("renameFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
