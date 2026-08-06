import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import PendingComponent from "@/components/loading/PendingComponent";
import { useCan } from "@/hooks/permissions/useCan";
import type { ClassPermission } from "@/lib/permissions/classPermissions";

type RequirePermissionProps = {
  permission: ClassPermission;
  children: ReactNode;
};

/**
 * Page guard: denied looks identical to class-not-found (no new i18n keys).
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, isPending } = useCan();
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");

  if (isPending) {
    return <PendingComponent />;
  }

  if (!can(permission)) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-8">
        <Empty card>
          <EmptyHeader>
            <EmptyTitle>{t("classNotFound")}</EmptyTitle>
            <EmptyDescription>{tCommon("notFoundDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-row justify-center gap-2">
            <Button type="button" nativeButton={false} render={<Link to="/" />}>
              {tCommon("goHome")}
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  return children;
}
