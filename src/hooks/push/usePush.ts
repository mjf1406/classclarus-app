import { convexQuery } from "@convex-dev/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import { toast } from "@/components/ui/toast-manager";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { ONE_HOUR } from "@/lib/queryCache";

export function vapidPublicKeyQueryKey() {
  return convexQuery(api.push.getVapidPublicKey, {}).queryKey;
}

export function pushSubscriptionsQueryKey() {
  return convexQuery(api.push.listMine, {}).queryKey;
}

export function useVapidPublicKey() {
  return useAuthedQuery(api.push.getVapidPublicKey, {}, { gcTime: ONE_HOUR });
}

export function usePushSubscriptions() {
  return useAuthedQuery(api.push.listMine, {}, { gcTime: ONE_HOUR });
}

export function useSubscribePush() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.push.subscribe);
  const listKey = pushSubscriptionsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
      mutationFn(args),
    queryKeys: [listKey],
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("pushEnableFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}

export function useUnsubscribePush() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.push.unsubscribe);
  const listKey = pushSubscriptionsQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { endpoint: string }) => mutationFn(args),
    queryKeys: [listKey],
    applyOptimisticUpdate: (queryClient, args) => {
      queryClient.setQueryData<Array<{ _id: string; endpoint: string; createdAt: number }>>(
        listKey,
        (old) => old?.filter((row) => row.endpoint !== args.endpoint) ?? old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("pushDisableFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
