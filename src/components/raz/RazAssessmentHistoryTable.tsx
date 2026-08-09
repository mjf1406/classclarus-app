import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLanguageOption, isAppLanguage } from "@/lib/languages";
import type { RazAssessmentEntry } from "@/lib/raz/levels";

const RESULT_I18N_KEY = {
  level_up: "resultLevelUp",
  stay: "resultStay",
  level_down: "resultLevelDown",
} as const;

function formatMediumDateTime(timestampMs: number, language: string): string {
  const locale = isAppLanguage(language) ? getLanguageOption(language).htmlLang : language;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

type RazAssessmentHistoryTableProps = {
  assessments: RazAssessmentEntry[];
};

export function RazAssessmentHistoryTable({ assessments }: RazAssessmentHistoryTableProps) {
  const { t, i18n } = useTranslation("raz");

  if (assessments.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>;
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("dateLabel")}</TableHead>
            <TableHead>{t("levelLabel")}</TableHead>
            <TableHead>{t("resultLabel")}</TableHead>
            <TableHead>{t("readLabel")}</TableHead>
            <TableHead>{t("retellLabel")}</TableHead>
            <TableHead>{t("respondLabel")}</TableHead>
            <TableHead>{t("noteLabel")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assessments.map((assessment) => (
            <TableRow key={assessment._id}>
              <TableCell className="whitespace-nowrap tabular-nums">
                {formatMediumDateTime(assessment.assessedAt, i18n.language)}
              </TableCell>
              <TableCell className="font-medium tabular-nums">{assessment.level}</TableCell>
              <TableCell>{t(RESULT_I18N_KEY[assessment.result])}</TableCell>
              <TableCell className="tabular-nums">{assessment.readAccuracy}%</TableCell>
              <TableCell className="tabular-nums">
                {assessment.retellScore == null ? "—" : assessment.retellScore}
              </TableCell>
              <TableCell className="tabular-nums">{assessment.respondScore}</TableCell>
              <TableCell className="max-w-[16rem] truncate">
                {assessment.note?.trim() ? assessment.note : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
