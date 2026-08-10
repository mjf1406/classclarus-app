import { useState } from "react";
import { UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SeedTestStudentsConfirmDialog } from "@/components/admin/SeedTestStudentsConfirmDialog";
import { Button } from "@/components/ui/button";
import { useIsSiteAdmin } from "@/hooks/admin/useIsSiteAdmin";
import type { Id } from "../../../convex/_generated/dataModel";

type SeedTestStudentsButtonProps = {
  classId: Id<"classes">;
  classDisplayName: string;
};

/** Site-admin control on the class dashboard for seeding test roster students. */
export function SeedTestStudentsButton({ classId, classDisplayName }: SeedTestStudentsButtonProps) {
  const { t } = useTranslation("admin");
  const { isAdmin } = useIsSiteAdmin();
  const [open, setOpen] = useState(false);

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
