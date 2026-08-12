import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useEquitableAssignerRunById } from "@/hooks/assigners/equitable/useEquitableAssigners";
import {
  formatEquitableAssignerBalanceGender,
  formatEquitableAssignerScope,
} from "@/lib/assigners/equitableAssigners";
import { buildRandomAssignerPrintMatrix } from "@/lib/assigners/randomAssignerPrint";
import type { Id } from "../../../../convex/_generated/dataModel";

type EquitableAssignerDisplayPageProps = {
  runId: Id<"equitableAssignerRuns">;
};

export function EquitableAssignerDisplayPage({ runId }: EquitableAssignerDisplayPageProps) {
  const { t } = useTranslation("assigners");
  const { data: run, isPending, isError, refetch } = useEquitableAssignerRunById(runId);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const matrix = useMemo(() => {
    if (!run) return null;
    return buildRandomAssignerPrintMatrix(run, {
      classColumn: t("equitableScopeClass"),
      ungroupedColumn: t("randomUngroupedLabel"),
      nameFormat: run.nameFormat,
    });
  }, [run, t]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || !matrix) return;

    const updateScale = () => {
      const pad = 24;
      const availableWidth = Math.max(frame.clientWidth - pad, 1);
      const availableHeight = Math.max(frame.clientHeight - pad, 1);
      const next = Math.min(
        1,
        availableWidth / Math.max(content.scrollWidth, 1),
        availableHeight / Math.max(content.scrollHeight, 1),
      );
      setScale(Number.isFinite(next) ? next : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [matrix]);

  if (isError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState
          title={t("equitableDisplayLoadFailed")}
          description={t("equitableDisplayLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex h-dvh flex-col gap-3 p-4">
        <Skeleton className="h-8 w-48 shrink-0" />
        <Skeleton className="min-h-0 w-full flex-1" />
      </div>
    );
  }

  if (!run || !matrix) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <ErrorState
          title={t("equitableDisplayNotFound")}
          description={t("equitableDisplayNotFoundDescription")}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h1 className="text-lg font-semibold leading-tight sm:text-xl">{run.assignerName}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t("equitableDisplayMeta", {
              scope: formatEquitableAssignerScope(run.scope, t),
              balanceGender: formatEquitableAssignerBalanceGender(run.balanceGender, t),
              count: run.assignments.length,
              date: new Date(run.ranAt).toLocaleString(),
            })}
          </p>
        </div>
      </header>

      <main ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
        <div
          ref={contentRef}
          className="absolute top-2 left-2 origin-top-left sm:top-3 sm:left-3"
          style={{ transform: `scale(${scale})` }}
        >
          <table className="w-max min-w-full border-collapse text-[clamp(0.75rem,1.8vw,1.125rem)]">
            <thead>
              <tr>
                <th className="border bg-muted px-2 py-1.5 text-left font-semibold">
                  {t("equitablePrintItemColumn")}
                </th>
                {matrix.groupNames.map((name) => (
                  <th key={name} className="border bg-muted px-2 py-1.5 text-left font-semibold">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.item}>
                  <td className="border px-2 py-1.5 align-top font-semibold whitespace-nowrap">
                    {row.item}
                  </td>
                  {row.cells.map((students, columnIndex) => (
                    <td
                      key={`${row.item}-${matrix.groupNames[columnIndex] ?? columnIndex}`}
                      className="border px-2 py-1.5 align-top"
                    >
                      {students.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {students.map((student, studentIndex) => (
                            <li key={`${student}-${studentIndex}`} className="leading-snug">
                              {student}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
