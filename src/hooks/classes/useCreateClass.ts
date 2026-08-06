import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { ownedClassesQueryKey } from "@/hooks/classes/useOwnedClasses";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type CreateClassArgs = {
  name: string;
  year: number;
  description?: string;
  icon?: string;
};

export function useCreateClass() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classes.create);
  const queryKey = classesListQueryKey();
  const ownedKey = ownedClassesQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: CreateClassArgs) => mutationFn(args),
    queryKeys: [queryKey, ownedKey],
    applyOptimisticUpdate: (queryClient, args) => {
      const optimisticId = `optimistic:${randomClientId()}` as Id<"classes">;
      const now = Date.now();
      const optimistic: ClassPublic = {
        _id: optimisticId,
        _creationTime: now,
        ownerId: "optimistic" as Id<"users">,
        name: args.name,
        year: args.year,
        description: args.description,
        icon: args.icon,
        updatedAt: now,
        role: "owner",
        _pending: true,
      };
      queryClient.setQueryData<ClassPublic[]>(queryKey, (old) =>
        old ? [optimistic, ...old] : [optimistic],
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
