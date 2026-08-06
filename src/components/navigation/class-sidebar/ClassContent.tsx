import { Outlet } from "@tanstack/react-router";

import PendingComponent from "@/components/loading/PendingComponent";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";

export function ClassContent({ classPending }: { classPending: boolean }) {
  const { isPending: permissionsPending } = useClassPermissionsContext();

  if (classPending || permissionsPending) {
    return <PendingComponent inset />;
  }

  return <Outlet />;
}
