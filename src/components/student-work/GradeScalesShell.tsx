import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { GradeScalesTabs, type GradeScalesTab } from "@/components/student-work/GradeScalesTabs";
import type { Id } from "../../../convex/_generated/dataModel";

type GradeScalesShellProps = {
  classId: Id<"classes">;
  tab: GradeScalesTab;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function GradeScalesShell({
  classId,
  tab,
  description,
  action,
  children,
}: GradeScalesShellProps) {
  const { t } = useTranslation("studentWork");

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("navGradeScales")}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <GradeScalesTabs classId={classId} value={tab} />

      <p className="hidden text-muted-foreground sm:block">{description}</p>

      {children}
    </div>
  );
}
