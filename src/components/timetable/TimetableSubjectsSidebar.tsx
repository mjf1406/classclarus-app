import { Pencil, PanelRightClose, PanelRightOpen, Plus, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FontAwesomeIconFromId } from "@/components/icons/FontAwesomeIconFromId";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorageValue } from "@/hooks/useLocalStorageValue";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { TimetableSubject, TimetableWeekBundle } from "@/lib/timetable/timetable";
import { cn } from "@/lib/utils";

function isSubjectsSidebarOpen(value: string): value is "open" | "closed" {
  return value === "open" || value === "closed";
}

function useTimetableSubjectsSidebarOpen() {
  const [stored, setStored] = useLocalStorageValue(
    STORAGE_KEYS.timetableSubjectsSidebar,
    "closed",
    isSubjectsSidebarOpen,
  );
  return {
    open: stored === "open",
    setOpen: (next: boolean) => setStored(next ? "open" : "closed"),
    toggle: () => setStored(stored === "open" ? "closed" : "open"),
  };
}

function SubjectRow({
  subject,
  inCurrentView,
  canManage,
  onEdit,
  onDelete,
}: {
  subject: TimetableSubject;
  inCurrentView: boolean;
  canManage: boolean;
  onEdit: (subject: TimetableSubject) => void;
  onDelete: (subject: TimetableSubject) => void;
}) {
  const { t } = useTranslation("timetable");
  const menuItems = useMemo<Array<ActionMenuItem>>(
    () => [
      {
        id: "edit",
        label: t("editAction"),
        icon: <Pencil />,
        permission: "timetable:manage",
        group: "manage",
        onSelect: () => onEdit(subject),
      },
      {
        id: "delete",
        label: t("deleteAction"),
        icon: <Trash2 />,
        permission: "timetable:manage",
        variant: "destructive",
        group: "danger",
        onSelect: () => onDelete(subject),
      },
    ],
    [onDelete, onEdit, subject, t],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        inCurrentView && "opacity-40",
      )}
      style={{
        backgroundColor: subject.bgColor,
        color: subject.textColor,
      }}
    >
      {subject.iconName ? (
        <FontAwesomeIconFromId id={subject.iconName} className="size-4 shrink-0" />
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-current opacity-80" />
      )}
      {inCurrentView ? <X className="size-3 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate font-medium">{subject.name}</span>
      {canManage ? (
        <ActionMenu
          items={menuItems}
          label={t("subjectActions")}
          className="relative z-10 shrink-0 text-current hover:bg-black/15"
        />
      ) : null}
    </div>
  );
}

type TimetableSubjectsSidebarPanelProps = {
  bundle: TimetableWeekBundle;
  canManage: boolean;
  onCreateSubject: () => void;
  onEditSubject: (subject: TimetableSubject) => void;
  onDeleteSubject: (subject: TimetableSubject) => void;
};

function SubjectsListBody({
  subjects,
  subjectsInView,
  canManage,
  onCreateSubject,
  onEditSubject,
  onDeleteSubject,
}: {
  subjects: Array<TimetableSubject>;
  subjectsInView: Set<string>;
  canManage: boolean;
  onCreateSubject: () => void;
  onEditSubject: (subject: TimetableSubject) => void;
  onDeleteSubject: (subject: TimetableSubject) => void;
}) {
  const { t } = useTranslation("timetable");

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">{t("subjectsEmpty")}</p>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={onCreateSubject}>
            <Plus data-icon="inline-start" />
            {t("createSubject")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-1.5 p-3">
        {subjects.map((subject) => (
          <SubjectRow
            key={subject._id}
            subject={subject}
            inCurrentView={subjectsInView.has(subject._id)}
            canManage={canManage}
            onEdit={onEditSubject}
            onDelete={onDeleteSubject}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function TimetableSubjectsSidebarPanel({
  bundle,
  canManage,
  onCreateSubject,
  onEditSubject,
  onDeleteSubject,
}: TimetableSubjectsSidebarPanelProps) {
  const { t } = useTranslation("timetable");
  const isMobile = useIsMobile();
  const { open, setOpen } = useTimetableSubjectsSidebarOpen();

  const subjectsInView = useMemo(() => {
    const ids = new Set<string>();
    for (const lesson of bundle.lessons) {
      ids.add(lesson.subjectId);
    }
    return ids;
  }, [bundle.lessons]);

  const body = (
    <SubjectsListBody
      subjects={bundle.subjects}
      subjectsInView={subjectsInView}
      canManage={canManage}
      onCreateSubject={onCreateSubject}
      onEditSubject={onEditSubject}
      onDeleteSubject={onDeleteSubject}
    />
  );

  const createButton = canManage ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onCreateSubject}
      aria-label={t("createSubject")}
    >
      <Plus />
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[min(100%,20rem)] flex-col p-0">
          <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
            <SheetTitle>{t("subjectsSidebarTitle")}</SheetTitle>
            {createButton}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{t("subjectsSidebarTitle")}</span>
        {createButton}
      </div>
      {body}
    </aside>
  );
}

export function TimetableSubjectsSidebarToggle() {
  const { t } = useTranslation("timetable");
  const { open, toggle } = useTimetableSubjectsSidebarOpen();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={toggle}
      aria-label={open ? t("hideSubjects") : t("showSubjects")}
      aria-expanded={open}
    >
      {open ? <PanelRightClose /> : <PanelRightOpen />}
    </Button>
  );
}
