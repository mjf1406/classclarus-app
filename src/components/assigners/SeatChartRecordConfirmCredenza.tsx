import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SeatChartViolationsList } from "@/components/assigners/SeatChartViolationsList";
import { AutoAssignExceptionsList } from "@/components/assigners/AutoAssignExceptionsList";
import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProgressButton } from "@/components/ui/progress-button";
import type { SeatChartViolation } from "@/lib/assigners/seatCharts";
import { hasAppliedRelaxations } from "@/lib/assigners/seating/autoAssignRecovery";
import type { SeatingRelaxations } from "../../../convex/lib/seating/types";
import type { Id } from "../../../convex/_generated/dataModel";

const CLOSE_AFTER_SUCCESS_MS = 500;

type SeatChartRecordConfirmCredenzaProps = {
  classId: Id<"classes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatedCount: number;
  unseatedCount: number;
  violations: Array<SeatChartViolation>;
  appliedRelaxations?: SeatingRelaxations;
  onConfirm: () => Promise<void>;
};

export function SeatChartRecordConfirmCredenza({
  classId,
  open,
  onOpenChange,
  seatedCount,
  unseatedCount,
  violations,
  appliedRelaxations,
  onConfirm,
}: SeatChartRecordConfirmCredenzaProps) {
  const { t } = useTranslation("assigners");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setBusy(false);
    }
  }, [open]);

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{t("chartRecordTitle")}</CredenzaTitle>
          <CredenzaDescription>{t("chartRecordDescription")}</CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="flex flex-col gap-3">
          <p className="text-sm">
            {t("chartRecordSummary", { seated: seatedCount, unseated: unseatedCount })}
          </p>
          <p className="text-sm text-muted-foreground">{t("chartNeighborsHelp")}</p>
          {appliedRelaxations && hasAppliedRelaxations(appliedRelaxations) ? (
            <Alert>
              <AlertTitle>{t("autoAssignRecordExceptionsTitle")}</AlertTitle>
              <AlertDescription>
                <p className="text-sm">{t("autoAssignRecordExceptionsDescription")}</p>
                <AutoAssignExceptionsList
                  classId={classId}
                  appliedRelaxations={appliedRelaxations}
                />
              </AlertDescription>
            </Alert>
          ) : null}
          {violations.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>{t("chartViolationsTitle")}</AlertTitle>
              <AlertDescription>
                <SeatChartViolationsList
                  violations={violations}
                  className="mt-2 flex flex-col gap-3"
                />
              </AlertDescription>
            </Alert>
          ) : null}
        </CredenzaBody>
        <CredenzaFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <ProgressButton
            key={open ? "open" : "closed"}
            type="button"
            progress={progress}
            onClick={async () => {
              setBusy(true);
              setProgress(25);
              try {
                await onConfirm();
                setProgress(100);
              } catch (error) {
                setBusy(false);
                setProgress(0);
                throw error;
              }
            }}
            onSuccess={() => {
              window.setTimeout(() => {
                onOpenChange(false);
                setBusy(false);
                setProgress(0);
              }, CLOSE_AFTER_SUCCESS_MS);
            }}
          >
            {t("chartRecordAction")}
          </ProgressButton>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
