import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  AssignersSeatsTabs,
  type AssignersSeatsTab,
} from "@/components/assigners/AssignersSeatsTabs";
import type { Id } from "../../../convex/_generated/dataModel";

type AssignersSeatsShellProps = {
  classId: Id<"classes">;
  tab: AssignersSeatsTab;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

/**
 * Shared seats chrome: title + tabs stay fixed while description/CTA/content
 * change per tab — avoids the tab row jumping when header height or width shifts.
 */
export function AssignersSeatsShell({
  classId,
  tab,
  description,
  action,
  children,
}: AssignersSeatsShellProps) {
  const { t } = useTranslation("assigners");

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("navSeats")}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <AssignersSeatsTabs classId={classId} value={tab} />

      <p className="hidden text-muted-foreground sm:block">{description}</p>

      {children}
    </div>
  );
}
