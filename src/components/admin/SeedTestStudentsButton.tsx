import { useState } from "react";
import { UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SeedTestStudentsConfirmDialog } from "@/components/admin/SeedTestStudentsConfirmDialog";
import { Button } from "@/components/ui/button";
import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { useIsFeedbackAdmin } from "@/hooks/feedback/useIsFeedbackAdmin";
import { isSelfHosted } from "@/lib/selfHosted";
import type { Id } from "../../../convex/_generated/dataModel";

type SeedTestStudentsButtonProps = {
  classId: Id<"classes">;
  classDisplayName: string;
};

/** Site-admin control on the class dashboard for seeding test roster students. */
export function SeedTestStudentsButton({ classId, classDisplayName }: SeedTestStudentsButtonProps) {
  const { t } = useTranslation("admin");
  const selfHosted = isSelfHosted();
  const selfHostAdmin = useIsAppAdmin();
  const feedbackAdmin = useIsFeedbackAdmin();
  const [open, setOpen] = useState(false);

  const isAdmin = selfHosted ? selfHostAdmin.isAdmin : feedbackAdmin.isAdmin;
  if (!isAdmin) {
    return null;
  }

  const label = t("seedNavButton");

  return (
    <>
      <Button variant="outline" size="sm" aria-label={label} onClick={() => setOpen(true)}>
        <UsersIcon data-icon="inline-start" />
        {label}
      </Button>
      <SeedTestStudentsConfirmDialog
        open={open}
        onOpenChange={setOpen}
        classId={classId}
        classDisplayName={classDisplayName}
      />
    </>
  );
}
