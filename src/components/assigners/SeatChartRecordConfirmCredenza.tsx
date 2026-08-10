import { useTranslation } from "react-i18next";

import { SeatChartViolationsList } from "@/components/assigners/SeatChartViolationsList";
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
import type { SeatChartViolation } from "@/lib/assigners/seatCharts";

type SeatChartRecordConfirmCredenzaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatedCount: number;
  unseatedCount: number;
  violations: Array<SeatChartViolation>;
  pending?: boolean;
  onConfirm: () => Promise<void>;
};

export function SeatChartRecordConfirmCredenza({
  open,
  onOpenChange,
  seatedCount,
  unseatedCount,
  violations,
  pending = false,
  onConfirm,
}: SeatChartRecordConfirmCredenzaProps) {
  const { t } = useTranslation("assigners");

  return (
    <Credenza open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
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
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
              void onConfirm();
            }}
          >
            {t("chartRecordAction")}
          </Button>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}
