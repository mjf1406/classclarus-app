import { Copy, Eye, EyeOff, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { GradeScaleDuplicateCredenza } from "@/components/student-work/GradeScaleDuplicateCredenza";
import { GradeScaleFormCredenza } from "@/components/student-work/GradeScaleFormCredenza";
import { GradeScalesShell } from "@/components/student-work/GradeScalesShell";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateGradeScale } from "@/hooks/gradeScales/useCreateGradeScale";
import { useDuplicateGradeScale } from "@/hooks/gradeScales/useDuplicateGradeScale";
import { useEnsureSystemGradeScales } from "@/hooks/gradeScales/useEnsureSystemGradeScales";
import { useGradeScales } from "@/hooks/gradeScales/useGradeScales";
import { useRemoveGradeScale } from "@/hooks/gradeScales/useRemoveGradeScale";
import { useSetGradeScaleDefaultHidden } from "@/hooks/gradeScales/useSetGradeScaleDefaultHidden";
import { useUpdateGradeScale } from "@/hooks/gradeScales/useUpdateGradeScale";
import { useCan } from "@/hooks/permissions/useCan";
import {
  duplicateGradeScaleName,
  formatLevelRange,
  resolveGradeScaleDisplayName,
  type GradeScaleFormValues,
  type GradeScaleListItem,
} from "@/lib/gradeScales/gradeScales";
import type { Id } from "../../../convex/_generated/dataModel";

const GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

type GradeScalesPageProps = {
  classId: Id<"classes">;
};

export function GradeScalesPage({ classId }: GradeScalesPageProps) {
  const { t } = useTranslation("studentWork");
  const { can } = useCan();
  const canManage = can("gradeScales:manage");
  const { data, isPending, isError, refetch } = useGradeScales(classId);
  useEnsureSystemGradeScales(can("gradeScales:read"));

  const createScale = useCreateGradeScale();
  const updateScale = useUpdateGradeScale();
  const removeScale = useRemoveGradeScale();
  const duplicateScale = useDuplicateGradeScale();
  const setDefaultHidden = useSetGradeScaleDefaultHidden();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GradeScaleListItem | null>(null);
  const [deleting, setDeleting] = useState<GradeScaleListItem | null>(null);
  const [duplicating, setDuplicating] = useState<GradeScaleListItem | null>(null);
  const [showHiddenDefaults, setShowHiddenDefaults] = useState(false);

  const hiddenDefaultCount = useMemo(
    () => data?.filter((scale) => scale.isSystem && scale.isHidden).length ?? 0,
    [data],
  );

  const visibleScales = useMemo(() => {
    if (!data) return [];
    return data.filter((scale) => !scale.isHidden || showHiddenDefaults);
  }, [data, showHiddenDefaults]);

  const displayName = (scale: GradeScaleListItem) =>
    resolveGradeScaleDisplayName(scale, t, t("unnamedScale"));

  const submitForm = async (values: GradeScaleFormValues) => {
    if (editing) {
      await updateScale.mutateAsync({
        classId,
        gradeScaleId: editing._id,
        name: values.name,
        levels: values.levels,
      });
      return;
    }
    await createScale.mutateAsync({
      classId,
      name: values.name,
      levels: values.levels,
    });
  };

  return (
    <GradeScalesShell
      classId={classId}
      tab="scales"
      description={t("scalesDescription")}
      action={
        canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createScale")}
          </Button>
        ) : null
      }
    >
      {isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GraduationCap />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createScale")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 && visibleScales.length === 0 ? (
        <Empty card>
          <EmptyHeader>
            <EmptyTitle>{t("allDefaultsHiddenTitle")}</EmptyTitle>
            <EmptyDescription>{t("allDefaultsHiddenDescription")}</EmptyDescription>
          </EmptyHeader>
          {hiddenDefaultCount > 0 ? (
            <EmptyContent>
              <Button type="button" variant="outline" onClick={() => setShowHiddenDefaults(true)}>
                <Eye className="size-4" />
                {t("showHiddenDefaults")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending &&
      !isError &&
      data &&
      data.length > 0 &&
      hiddenDefaultCount > 0 &&
      visibleScales.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowHiddenDefaults((current) => !current)}
          >
            {showHiddenDefaults ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showHiddenDefaults ? t("hideHiddenDefaults") : t("showHiddenDefaults")}
          </Button>
        </div>
      ) : null}

      {!isPending && !isError && visibleScales.length > 0 ? (
        <ul className={GRID_CLASS}>
          {visibleScales.map((scale) => {
            const name = displayName(scale);
            const menuItems: Array<ActionMenuItem> = [
              ...(scale.isSystem
                ? [
                    {
                      id: scale.isHidden ? "show" : "hide",
                      label: scale.isHidden ? t("showAction") : t("hideAction"),
                      icon: scale.isHidden ? <Eye /> : <EyeOff />,
                      permission: "gradeScales:manage" as const,
                      group: "manage",
                      onSelect: () => {
                        if (!scale.systemKey) return;
                        void setDefaultHidden.mutateAsync({
                          classId,
                          systemKey: scale.systemKey,
                          hidden: !scale.isHidden,
                        });
                      },
                    },
                  ]
                : [
                    {
                      id: "edit",
                      label: t("editAction"),
                      icon: <Pencil />,
                      permission: "gradeScales:manage" as const,
                      group: "manage",
                      onSelect: () => setEditing(scale),
                    },
                  ]),
              {
                id: "duplicate",
                label: t("duplicateAction"),
                icon: <Copy />,
                permission: "gradeScales:manage",
                group: "manage",
                onSelect: () => setDuplicating(scale),
              },
              ...(scale.isSystem
                ? []
                : [
                    {
                      id: "delete",
                      label: t("deleteAction"),
                      icon: <Trash2 />,
                      permission: "gradeScales:manage" as const,
                      variant: "destructive" as const,
                      group: "danger",
                      onSelect: () => setDeleting(scale),
                    },
                  ]),
            ];

            return (
              <li key={scale._id}>
                <Card
                  size="sm"
                  className={`h-full transition-colors hover:bg-accent/40 ${scale.isHidden ? "opacity-60" : ""}`}
                >
                  <CardHeader className="flex flex-row items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base font-semibold">{name}</CardTitle>
                      <CardDescription className="mt-1">
                        {t("gradeCount", { count: scale.levels.length })}
                      </CardDescription>
                    </div>
                    <div className="shrink-0">
                      <ActionMenu items={menuItems} label={t("scaleActions")} />
                    </div>
                  </CardHeader>
                  <CardContent className="border-t pt-0">
                    <ul className="divide-y">
                      {scale.levels.map((level) => (
                        <li
                          key={level.key}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span className="font-medium tabular-nums">{level.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatLevelRange(level)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      <GradeScaleFormCredenza
        open={createOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onSubmit={submitForm}
      />

      <GradeScaleDuplicateCredenza
        open={duplicating !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicating(null);
        }}
        source={duplicating}
        defaultName={
          duplicating ? duplicateGradeScaleName(displayName(duplicating), t("copySuffix")) : ""
        }
        onSubmit={async (name) => {
          if (!duplicating) return;
          await duplicateScale.mutateAsync({
            classId,
            gradeScaleId: duplicating._id,
            name,
          });
        }}
      />

      <DeleteNamedCredenza
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("deleteScaleTitle")}
        description={t("deleteScaleDescription", {
          name: deleting ? displayName(deleting) : "",
        })}
        confirmLabel={t("confirmDelete")}
        onConfirm={async () => {
          if (!deleting) return;
          await removeScale.mutateAsync({
            classId,
            gradeScaleId: deleting._id,
          });
        }}
      />
    </GradeScalesShell>
  );
}
