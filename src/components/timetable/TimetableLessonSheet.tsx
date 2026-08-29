import { useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import { Label } from "@/components/ui/label";
import { TimetableAgendaAddMenu } from "@/components/timetable/TimetableAgendaAddMenu";
import { TimetableAgendaItemView } from "@/components/timetable/TimetableAgendaItemView";
import { TimetableSectionListEditor } from "@/components/timetable/TimetableSectionListEditor";
import { TimetableTaggedText } from "@/components/timetable/TimetableTaggedText";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUpsertLesson } from "@/hooks/timetable/useTimetableMutations";
import { useTimetableTags } from "@/hooks/timetable/useTimetableQueries";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { rowFocusTargetProps } from "@/hooks/usePendingRowFocus";
import { api } from "../../../convex/_generated/api";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import { GC_TIME } from "@/lib/queryCache";
import { formatEventTimeLabel } from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { agendaItemKind, findAgendaResourceName } from "@/lib/timetable/agendaItems";
import type {
  AgendaItemFormValues,
  SectionItemFormValues,
  TimetableLesson,
  TimetableUpcomingEvent,
} from "@/lib/timetable/timetable";
import type { Id } from "../../../convex/_generated/dataModel";

type TimetableLessonSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: Id<"classes">;
  termId: Id<"timetableTerms">;
  year: number;
  weekNumber: number;
  lesson: TimetableLesson | null;
  canManage: boolean;
};

export function TimetableLessonSheet({
  open,
  onOpenChange,
  classId,
  termId,
  year,
  weekNumber,
  lesson,
  canManage,
}: TimetableLessonSheetProps) {
  const { t, i18n } = useTranslation("timetable");
  const upsertLesson = useUpsertLesson();
  const { data: tasks } = useTasks(classId);
  const { data: assignments } = useAssignments(classId);
  const { data: tags } = useTimetableTags(classId);
  const { data: classDoc } = useAuthedQuery(
    api.classes.get,
    { classId },
    { gcTime: GC_TIME.stable },
  );
  const timeZone =
    classDoc?.timezone && isValidTimeZone(classDoc.timezone) ? classDoc.timezone : "UTC";

  const [materials, setMaterials] = useState<Array<SectionItemFormValues>>([]);
  const [announcements, setAnnouncements] = useState<Array<SectionItemFormValues>>([]);
  const [agenda, setAgenda] = useState<Array<AgendaItemFormValues>>([]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setMaterials(lesson.materials.map((item) => ({ ...item })));
    setAnnouncements(lesson.announcements.map((item) => ({ ...item })));
    setAgenda(lesson.agenda.map((item) => ({ ...item })));
    setComplete(lesson.complete);
  }, [lesson]);

  if (!lesson) return null;

  const subject = lesson.subject;
  const locale = toIntlLocale(i18n.language);

  const save = () => {
    upsertLesson.mutate(
      {
        classId,
        termId,
        slotId: lesson.slotId,
        subjectId: lesson.subjectId,
        year,
        weekNumber,
        complete,
        materials: materials.filter((item) => item.text.trim().length > 0),
        announcements: announcements.filter((item) => item.text.trim().length > 0),
        agenda: agenda.filter(
          (item) => item.text.trim().length > 0 || item.assignmentId || item.taskId,
        ),
        lessonId: lesson._id,
      },
      {
        onError: () => {
          onOpenChange(true);
        },
      },
    );
    onOpenChange(false);
  };

  const submitOnModEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey) || !canManage) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-[90dvh] min-h-0 w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden sm:w-[35vw] sm:max-w-[35vw]">
        <CredenzaHeader className="shrink-0">
          <CredenzaTitle>{subject.name}</CredenzaTitle>
          <CredenzaDescription>
            {canManage ? t("lessonEditDescription") : t("lessonViewDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManage) return;
            save();
          }}
          onKeyDown={submitOnModEnter}
        >
          <CredenzaBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <section className="flex flex-col gap-2">
              <h3 className="font-medium">{t("materialsSection")}</h3>
              {canManage ? (
                <TimetableSectionListEditor
                  items={materials}
                  onChange={setMaterials}
                  tags={tags ?? []}
                  placeholder={t("materialsPlaceholder")}
                />
              ) : (
                <ReadOnlyList items={materials} empty={t("noMaterials")} />
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium">{t("announcementsSection")}</h3>
              <UpcomingEventsList
                events={lesson.upcomingEvents}
                locale={locale}
                timeZone={timeZone}
              />
              {canManage ? (
                <TimetableSectionListEditor
                  items={announcements}
                  onChange={setAnnouncements}
                  tags={tags ?? []}
                  placeholder={t("announcementsPlaceholder")}
                />
              ) : (
                <ReadOnlyList items={announcements} empty={t("noExtraAnnouncements")} />
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium">{t("agendaSection")}</h3>
              {canManage ? (
                <TimetableSectionListEditor
                  items={agenda}
                  onChange={setAgenda}
                  tags={tags ?? []}
                  placeholder={t("agendaPlaceholder")}
                  renderAdd={() => (
                    <TimetableAgendaAddMenu
                      items={agenda}
                      onChange={setAgenda}
                      assignments={assignments ?? []}
                      tasks={tasks ?? []}
                    />
                  )}
                  renderControl={(item) => {
                    if (agendaItemKind(item) === "text") return null;
                    return (
                      <div
                        className="flex min-h-9 items-center"
                        tabIndex={0}
                        {...rowFocusTargetProps()}
                      >
                        <TimetableAgendaItemView
                          classId={classId}
                          text={item.text}
                          assignmentId={item.assignmentId}
                          taskId={item.taskId}
                          assignmentName={findAgendaResourceName(assignments, item.assignmentId)}
                          taskName={findAgendaResourceName(tasks, item.taskId)}
                        />
                      </div>
                    );
                  }}
                />
              ) : (
                <ReadOnlyAgenda
                  items={agenda}
                  classId={classId}
                  empty={t("noAgenda")}
                  assignments={assignments}
                  tasks={tasks}
                />
              )}
            </section>
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 sm:justify-between">
            {canManage ? (
              <div className="mr-auto flex items-center gap-2">
                <Checkbox
                  id="lesson-complete"
                  checked={complete}
                  onCheckedChange={(checked) => setComplete(checked === true)}
                />
                <Label htmlFor="lesson-complete">{t("markComplete")}</Label>
              </div>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <CredenzaClose render={<Button type="button" variant="outline" />}>
                {canManage ? t("cancel") : t("close")}
              </CredenzaClose>
              {canManage ? <Button type="submit">{t("saveAction")}</Button> : null}
            </div>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}

function UpcomingEventsList({
  events,
  locale,
  timeZone,
}: {
  events: Array<TimetableUpcomingEvent>;
  locale: string;
  timeZone: string;
}) {
  const { t } = useTranslation("timetable");
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noUpcomingEvents")}</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {events.map((event, index) => (
        <li key={event._id} className="text-sm">
          <span className="text-muted-foreground">{index + 1}. </span>
          <span className="font-medium">{event.title}</span>
          <span className="text-muted-foreground">
            {" "}
            — {formatEventTimeLabel(event, timeZone, locale, { includeDate: true })}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ReadOnlyList({ items, empty }: { items: Array<SectionItemFormValues>; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.key} className="text-sm">
          <span className="text-muted-foreground">{index + 1}. </span>
          <TimetableTaggedText text={item.text} />
        </li>
      ))}
    </ol>
  );
}

function ReadOnlyAgenda({
  items,
  classId,
  empty,
  assignments,
  tasks,
}: {
  items: Array<AgendaItemFormValues>;
  classId: Id<"classes">;
  empty: string;
  assignments?: ReadonlyArray<{ _id: string; name: string }>;
  tasks?: ReadonlyArray<{ _id: string; name: string }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={item.key} className="flex gap-1 text-sm">
          <span className="shrink-0 text-muted-foreground">{index + 1}. </span>
          <TimetableAgendaItemView
            classId={classId}
            text={item.text}
            assignmentId={item.assignmentId}
            taskId={item.taskId}
            assignmentName={findAgendaResourceName(assignments, item.assignmentId)}
            taskName={findAgendaResourceName(tasks, item.taskId)}
          />
        </li>
      ))}
    </ol>
  );
}
