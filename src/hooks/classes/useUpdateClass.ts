import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { patchDoc } from "@/lib/optimistic";

type ClassDoc = Doc<"classes">;

type UpdateClassArgs = {
  classId: Id<"classes">;
  name: string;
  year: number;
  description?: string;
  icon?: string;
};

export function useUpdateClass() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classes.update);
  const listKey = classesListQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: UpdateClassArgs) => mutationFn(args),
    queryKeys: (args) => [listKey, classDetailQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      const now = Date.now();
      const patch = {
        name: args.name,
        year: args.year,
        description: args.description,
        icon: args.icon,
        updatedAt: now,
      };
      queryClient.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId ? { ...classDoc, ...patch } : classDoc,
        );
      });
      queryClient.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({ ...doc, ...patch })),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
