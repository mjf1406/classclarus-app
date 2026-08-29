import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";

import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function classesListQueryKey() {
  return convexQuery(api.classes.listMine, {}).queryKey;
}

export function useClasses() {
  return useAuthedQuery(api.classes.listMine, {}, { gcTime: GC_TIME.stable });
}

/** Active (non-archived) classes derived from the listMine cache. */
export function useActiveClasses() {
  const { data, ...rest } = useClasses();
  const active = useMemo(
    () => (data ?? []).filter((classDoc) => classDoc.archivedAt === undefined),
    [data],
  );
  return { ...rest, data: active };
}
