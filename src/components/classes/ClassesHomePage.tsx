import { useMemo, useState } from "react";
import { GraduationCapIcon, SearchIcon } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { ClassCard } from "@/components/classes/ClassCard";
import {
  ClassFormCredenza,
  type ClassFormInitialValues,
} from "@/components/classes/ClassFormCredenza";
import { ClassesToolbar } from "@/components/classes/ClassesToolbar";
import { DeleteClassCredenza } from "@/components/classes/DeleteClassCredenza";
import { ClassPermissionsProvider } from "@/components/permissions/ClassPermissionsProvider";
import { ErrorState } from "@/components/ui/error-state";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { useClasses } from "@/hooks/classes/useClasses";
import { useClassSearch } from "@/hooks/classes/useClassSearch";
import { useCreateClass } from "@/hooks/classes/useCreateClass";
import { useDeleteClass } from "@/hooks/classes/useDeleteClass";
import { useSetClassArchived } from "@/hooks/classes/useSetClassArchived";
import { useUpdateClass } from "@/hooks/classes/useUpdateClass";
import type { ClassPublic } from "@/lib/classes/classes";
import type { ClassFormValues } from "@/lib/classes/classFormSchema";
import {
  nextSortState,
  partitionClassesByArchive,
  sortClasses,
  type ClassSortDirection,
  type ClassSortKey,
  type ClassViewMode,
} from "@/lib/classes/classSort";
import { cn } from "@/lib/utils";

type FormTarget = { mode: "create" } | { mode: "edit"; classDoc: ClassPublic };

function ClassesSkeleton({ viewMode }: { viewMode: ClassViewMode }) {
  const items = Array.from({ length: 3 }, (_, index) => index);
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-3">
        {items.map((index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <Skeleton className="size-10 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((index) => (
        <Card key={index} size="sm">
          <CardHeader className="flex flex-row items-start gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-1/2" />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-2/3" />
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ClassesHomePage() {
  const { t } = useTranslation("classes");
  const navigate = useNavigate();
  const { entitlement } = useEntitlement();
  const { data, isPending, isError, refetch } = useClasses();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const setArchived = useSetClassArchived();
  const deleteClass = useDeleteClass();

  const [sortKey, setSortKey] = useState<ClassSortKey>("name");
  const [sortDirection, setSortDirection] = useState<ClassSortDirection>("asc");
  const [viewMode, setViewMode] = useState<ClassViewMode>("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget>({ mode: "create" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassPublic | null>(null);

  const { filtered } = useClassSearch({ classes: data, query: searchQuery });
  const hasActiveSearch = searchQuery.trim().length > 0;

  const { active, archived } = useMemo(() => {
    const partitioned = partitionClassesByArchive(filtered);
    return {
      active: sortClasses(partitioned.active, sortKey, sortDirection),
      archived: sortClasses(partitioned.archived, sortKey, sortDirection),
    };
  }, [filtered, sortKey, sortDirection]);

  const resultCount = showArchived ? active.length + archived.length : active.length;
  const hasNoClasses = !isPending && !isError && (data?.length ?? 0) === 0;
  const hasNoSearchMatches =
    !isPending &&
    !isError &&
    hasActiveSearch &&
    active.length === 0 &&
    (!showArchived || archived.length === 0);

  const handleSortChange = (key: ClassSortKey) => {
    const next = nextSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  const openCreate = () => {
    if (entitlement?.status === "expired") {
      void navigate({ to: "/billing" });
      return;
    }
    setFormTarget({ mode: "create" });
    setFormOpen(true);
  };

  const openEdit = (classDoc: ClassPublic) => {
    setFormTarget({ mode: "edit", classDoc });
    setFormOpen(true);
  };

  const openDelete = (classDoc: ClassPublic) => {
    setDeleteTarget(classDoc);
    setDeleteOpen(true);
  };

  const formInitialValues: ClassFormInitialValues | undefined =
    formTarget.mode === "edit"
      ? {
          name: formTarget.classDoc.name,
          year: formTarget.classDoc.year,
          description: formTarget.classDoc.description,
          icon: formTarget.classDoc.icon,
        }
      : undefined;

  const handleFormSubmit = async (values: ClassFormValues) => {
    if (formTarget.mode === "edit") {
      await updateClass.mutateAsync({
        classId: formTarget.classDoc._id,
        name: values.name,
        year: values.year,
        description: values.description,
        icon: values.icon,
      });
      return;
    }
    await createClass.mutateAsync({
      name: values.name,
      year: values.year,
      description: values.description,
      icon: values.icon,
    });
  };

  const listClassName = cn(
    viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3",
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
      <ClassesToolbar
        sortKey={sortKey}
        sortDirection={sortDirection}
        viewMode={viewMode}
        showArchived={showArchived}
        searchQuery={searchQuery}
        resultCount={resultCount}
        onSearchChange={setSearchQuery}
        onSortChange={handleSortChange}
        onViewModeChange={setViewMode}
        onToggleArchived={() => setShowArchived((value) => !value)}
        onCreate={openCreate}
      />

      {isPending ? <ClassesSkeleton viewMode={viewMode} /> : null}

      {isError ? (
        <ErrorState
          card
          onRetry={async () => {
            await refetch();
          }}
          description={t("loadFailed")}
        />
      ) : null}

      {hasNoClasses ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon" size="20">
              <GraduationCapIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-row justify-center gap-2">
            <Button type="button" nativeButton={false} render={<Link to="/join" />}>
              {t("joinClass")}
            </Button>
            <Button type="button" variant="secondary" onClick={openCreate}>
              {t("createClass")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {hasNoSearchMatches ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon" size="20">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("searchNoResultsTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchNoResults")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && !hasNoClasses && !hasNoSearchMatches && active.length > 0 ? (
        <div className={listClassName}>
          {active.map((classDoc) => (
            <ClassPermissionsProvider key={classDoc._id} role={classDoc.role}>
              <ClassCard
                classDoc={classDoc}
                viewMode={viewMode}
                onEdit={openEdit}
                onArchiveToggle={(doc) => {
                  void setArchived.mutateAsync({
                    classId: doc._id,
                    archived: doc.archivedAt === undefined,
                  });
                }}
                onDelete={openDelete}
              />
            </ClassPermissionsProvider>
          ))}
        </div>
      ) : null}

      {showArchived && !hasNoClasses && !hasNoSearchMatches ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("archivedSection")}</h2>
          {isPending ? <ClassesSkeleton viewMode={viewMode} /> : null}
          {!isPending && archived.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("archivedEmpty")}</p>
          ) : null}
          {!isPending && archived.length > 0 ? (
            <div className={listClassName}>
              {archived.map((classDoc) => (
                <ClassPermissionsProvider key={classDoc._id} role={classDoc.role}>
                  <ClassCard
                    classDoc={classDoc}
                    viewMode={viewMode}
                    onEdit={openEdit}
                    onArchiveToggle={(doc) => {
                      void setArchived.mutateAsync({
                        classId: doc._id,
                        archived: false,
                      });
                    }}
                    onDelete={openDelete}
                  />
                </ClassPermissionsProvider>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <ClassFormCredenza
        key={formTarget.mode === "edit" ? `edit:${formTarget.classDoc._id}` : "create"}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formTarget.mode}
        initialValues={formInitialValues}
        onSubmit={handleFormSubmit}
      />

      <DeleteClassCredenza
        key={deleteTarget ? `delete:${deleteTarget._id}` : "delete"}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        className={deleteTarget?.name ?? ""}
        onConfirm={async (confirmation) => {
          if (!deleteTarget) return;
          await deleteClass.mutateAsync({
            classId: deleteTarget._id,
            confirmation,
          });
        }}
      />
    </main>
  );
}
