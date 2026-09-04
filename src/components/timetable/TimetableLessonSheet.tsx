import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { useForm } from "@tanstack/react-form";
import { ExternalLink, Link2, Plus, Trash2, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SortableFormItem, SortableVerticalList } from "@/components/form/SortableFormList";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimetableAgendaAddMenu } from "@/components/timetable/TimetableAgendaAddMenu";
import { TimetableAgendaItemView } from "@/components/timetable/TimetableAgendaItemView";
import { TimetableAgendaPrefaceButton } from "@/components/timetable/TimetableAgendaPrefaceButton";
import { TimetableLessonPushToScreen } from "@/components/timetable/TimetableLessonPushToScreen";
import { TimetableSectionListEditor } from "@/components/timetable/TimetableSectionListEditor";
import { TimetableTaggedText } from "@/components/timetable/TimetableTaggedText";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUnlinkLesson, useUpsertLesson } from "@/hooks/timetable/useTimetableMutations";
import { useTimetableTags } from "@/hooks/timetable/useTimetableQueries";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { rowFocusTargetProps } from "@/hooks/usePendingRowFocus";
import { formatEventTimeLabel } from "@/lib/calendar/calendar";
import { toIntlLocale } from "@/lib/languages";
import { reorderByKey } from "@/lib/form/reorderByKey";
import { randomClientId } from "@/lib/optimistic";
import { GC_TIME } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";
import { isValidTimeZone } from "../../../convex/lib/calendar/timeZone";
import {
  isValidHttpUrl,
  MAX_LESSON_RESOURCES,
} from "../../../convex/lib/timetable/timetableSchema";
import { agendaItemKind, findAgendaResourceName } from "@/lib/timetable/agendaItems";
import {
  createClientTimetableLessonFormSchema,
  type TimetableLessonFormValues,
} from "@/lib/timetable/timetableFormSchema";
import {
  emptyLessonResource,
  type AgendaItemFormValues,
  type LessonResourceFormValues,
  type SectionItemFormValues,
  type TimetableLesson,
  type TimetableUpcomingEvent,
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

function fieldErrorMessage(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "message" in first) {
    const message = (first as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function valuesFromLesson(lesson: TimetableLesson): TimetableLessonFormValues {
  return {
    complete: lesson.complete,
    lessonUrl: lesson.lessonUrl ?? "",
    lessonUrlShared: lesson.lessonUrlShared === true,
    resources: (lesson.resources ?? []).map((item) => ({
      key: item.key,
      url: item.url,
      label: item.label ?? "",
    })),
    resourcesShared: lesson.resourcesShared === true,
    materials: lesson.materials.map((item) => ({ ...item })),
    announcements: lesson.announcements.map((item) => ({ ...item })),
    agenda: lesson.agenda.map((item) => ({ ...item })),
  };
}

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
  const unlinkLesson = useUnlinkLesson();
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const skipNextResetRef = useRef(false);
  const schema = useMemo(() => createClientTimetableLessonFormSchema(t), [t]);
  const defaults = useMemo(
    () =>
      lesson
        ? valuesFromLesson(lesson)
        : {
            complete: false,
            lessonUrl: "",
            lessonUrlShared: false,
            resources: [],
            resourcesShared: false,
            materials: [],
            announcements: [],
            agenda: [],
          },
    [lesson],
  );

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      if (!lesson || !canManage) return;
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message ?? t("saveFailed");
        const path = issue?.path[0];
        if (typeof path === "string") {
          form.setFieldMeta(path as keyof TimetableLessonFormValues, (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onSubmit: message },
            errors: [message],
          }));
        } else {
          setSubmitError(message);
        }
        return;
      }

      setSubmitError(null);
      onOpenChange(false);
      try {
        await upsertLesson.mutateAsync({
          classId,
          termId,
          slotId: lesson.slotId,
          subjectId: lesson.subjectId,
          year,
          weekNumber,
          complete: parsed.data.complete,
          materials: parsed.data.materials.filter((item) => item.text.trim().length > 0),
          announcements: parsed.data.announcements.filter((item) => item.text.trim().length > 0),
          agenda: parsed.data.agenda.filter(
            (item) => item.text.trim().length > 0 || item.assignmentId || item.taskId,
          ),
          lessonUrl: parsed.data.lessonUrl.trim() || undefined,
          lessonUrlShared: parsed.data.lessonUrlShared,
          resources: parsed.data.resources
            .filter((item) => item.url.trim().length > 0)
            .map((item) => ({
              key: item.key,
              url: item.url.trim(),
              ...(item.label.trim() ? { label: item.label.trim() } : {}),
            })),
          resourcesShared: parsed.data.resourcesShared,
          lessonId: lesson._id,
        });
      } catch (error) {
        skipNextResetRef.current = true;
        onOpenChange(true);
        setSubmitError(error instanceof Error ? error.message : t("saveFailed"));
      }
    },
  });

  useEffect(() => {
    if (!open) return;
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    form.reset(defaults);
    setSubmitError(null);
  }, [defaults, form, open]);

  if (!lesson) return null;

  const subject = lesson.subject;
  const locale = toIntlLocale(i18n.language);
  const safeLessonUrl = isValidHttpUrl(lesson.lessonUrl ?? "") ? lesson.lessonUrl : undefined;

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
          {lesson.lessonLinkGroupId ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                <Link2 className="h-3 w-3" />
                {t("linkedLessonBadge")}
              </span>
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={unlinkLesson.isPending}
                  onClick={() => {
                    void unlinkLesson.mutateAsync({
                      classId,
                      termId,
                      year,
                      weekNumber,
                      lessonId: lesson._id,
                    });
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {t("unlinkLessonAction")}
                </Button>
              ) : null}
              <TimetableLessonPushToScreen
                classId={classId}
                termId={termId}
                year={year}
                weekNumber={weekNumber}
                lessonId={lesson._id}
                slotId={lesson.slotId}
                timeZone={timeZone}
              />
            </div>
          ) : (
            <TimetableLessonPushToScreen
              classId={classId}
              termId={termId}
              year={year}
              weekNumber={weekNumber}
              lessonId={lesson._id}
              slotId={lesson.slotId}
              timeZone={timeZone}
              className="mt-2"
            />
          )}
        </CredenzaHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManage) return;
            void form.handleSubmit();
          }}
          onKeyDown={submitOnModEnter}
        >
          <CredenzaBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <form.Field name="lessonUrl">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="lesson-url">{t("lessonUrl")}</FieldLabel>
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id="lesson-url"
                          type="url"
                          inputMode="url"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={t("lessonUrlPlaceholder")}
                          aria-invalid={error ? true : undefined}
                        />
                        <OpenUrlIconButton url={field.state.value} label={t("openLinkInNewTab")} />
                      </div>
                    ) : safeLessonUrl ? (
                      <a
                        href={safeLessonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t("openLessonUrl")}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("noLessonUrl")}</p>
                    )}
                    {canManage ? (
                      <p className="text-xs text-muted-foreground">{t("lessonUrlHint")}</p>
                    ) : null}
                    {error ? <FieldError>{error}</FieldError> : null}
                    {canManage ? (
                      <form.Field name="lessonUrlShared">
                        {(shareField) => (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <Label htmlFor="lesson-url-shared">{t("lessonUrlShareLabel")}</Label>
                              <p className="text-xs text-muted-foreground">
                                {t("lessonUrlShareHint")}
                              </p>
                            </div>
                            <Switch
                              id="lesson-url-shared"
                              checked={shareField.state.value}
                              onCheckedChange={(checked) =>
                                shareField.handleChange(checked === true)
                              }
                            />
                          </div>
                        )}
                      </form.Field>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="resources">
              {(field) => {
                const error = fieldErrorMessage(field.state.meta.errors);
                return (
                  <section className="flex flex-col gap-2">
                    <h3 className="font-medium">{t("resourcesSection")}</h3>
                    {canManage ? (
                      <>
                        <ResourceLinksEditor
                          items={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          invalid={Boolean(error)}
                        />
                        {error ? <FieldError>{error}</FieldError> : null}
                        <form.Field name="resourcesShared">
                          {(shareField) => (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <Label htmlFor="lesson-resources-shared">
                                  {t("resourcesShareLabel")}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {t("resourcesShareHint")}
                                </p>
                              </div>
                              <Switch
                                id="lesson-resources-shared"
                                checked={shareField.state.value}
                                onCheckedChange={(checked) =>
                                  shareField.handleChange(checked === true)
                                }
                              />
                            </div>
                          )}
                        </form.Field>
                      </>
                    ) : (
                      <ReadOnlyResources items={field.state.value} empty={t("noResources")} />
                    )}
                  </section>
                );
              }}
            </form.Field>

            <form.Field name="materials">
              {(field) => (
                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">{t("materialsSection")}</h3>
                  {canManage ? (
                    <TimetableSectionListEditor
                      items={field.state.value}
                      onChange={field.handleChange}
                      tags={tags ?? []}
                      placeholder={t("materialsPlaceholder")}
                      sortable
                    />
                  ) : (
                    <ReadOnlyList items={field.state.value} empty={t("noMaterials")} />
                  )}
                </section>
              )}
            </form.Field>

            <form.Field name="announcements">
              {(field) => (
                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">{t("announcementsSection")}</h3>
                  <UpcomingEventsList
                    events={lesson.upcomingEvents}
                    locale={locale}
                    timeZone={timeZone}
                  />
                  {canManage ? (
                    <TimetableSectionListEditor
                      items={field.state.value}
                      onChange={field.handleChange}
                      tags={tags ?? []}
                      placeholder={t("announcementsPlaceholder")}
                    />
                  ) : (
                    <ReadOnlyList items={field.state.value} empty={t("noExtraAnnouncements")} />
                  )}
                </section>
              )}
            </form.Field>

            <form.Field name="agenda">
              {(field) => (
                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">{t("agendaSection")}</h3>
                  {canManage ? (
                    <TimetableSectionListEditor
                      items={field.state.value}
                      onChange={field.handleChange}
                      tags={tags ?? []}
                      placeholder={t("agendaPlaceholder")}
                      sortable
                      renderAdd={() => (
                        <TimetableAgendaAddMenu
                          items={field.state.value}
                          onChange={field.handleChange}
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
                              preface={item.preface}
                              assignmentId={item.assignmentId}
                              taskId={item.taskId}
                              assignmentName={findAgendaResourceName(
                                assignments,
                                item.assignmentId,
                              )}
                              taskName={findAgendaResourceName(tasks, item.taskId)}
                            />
                          </div>
                        );
                      }}
                      renderRowActions={(item, index) => {
                        if (agendaItemKind(item) === "text") return null;
                        return (
                          <TimetableAgendaPrefaceButton
                            preface={item.preface}
                            onChange={(preface) => {
                              field.handleChange(
                                field.state.value.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, preface } : row,
                                ),
                              );
                            }}
                          />
                        );
                      }}
                    />
                  ) : (
                    <ReadOnlyAgenda
                      items={field.state.value}
                      classId={classId}
                      empty={t("noAgenda")}
                      assignments={assignments}
                      tasks={tasks}
                    />
                  )}
                </section>
              )}
            </form.Field>
            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </CredenzaBody>
          <CredenzaFooter className="shrink-0 sm:justify-between">
            {canManage ? (
              <form.Field name="complete">
                {(field) => (
                  <div className="mr-auto flex items-center gap-2">
                    <Checkbox
                      id="lesson-complete"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked === true)}
                    />
                    <Label htmlFor="lesson-complete">{t("markComplete")}</Label>
                  </div>
                )}
              </form.Field>
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

function OpenUrlIconButton({ url, label }: { url: string; label: string }) {
  const safe = isValidHttpUrl(url.trim());
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      disabled={!safe}
      aria-label={label}
      onClick={() => {
        if (!safe) return;
        window.open(url.trim(), "_blank", "noopener,noreferrer");
      }}
    >
      <ExternalLink />
    </Button>
  );
}

function ResourceLinksEditor({
  items,
  onChange,
  onBlur,
  invalid,
}: {
  items: Array<LessonResourceFormValues>;
  onChange: (items: Array<LessonResourceFormValues>) => void;
  onBlur: () => void;
  invalid: boolean;
}) {
  const { t } = useTranslation("timetable");
  const canAdd = items.length < MAX_LESSON_RESOURCES;
  const canReorder = items.length > 1;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = reorderByKey(items, active.id, over.id);
    if (next) onChange(next);
  };

  const list =
    items.length > 0 ? (
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const row = (dragHandle: ReactNode) => (
            <>
              <div className="flex items-center gap-2">
                {dragHandle}
                <Input
                  type="url"
                  inputMode="url"
                  value={item.url}
                  onBlur={onBlur}
                  onChange={(event) =>
                    onChange(
                      items.map((rowItem, rowIndex) =>
                        rowIndex === index ? { ...rowItem, url: event.target.value } : rowItem,
                      ),
                    )
                  }
                  placeholder={t("resourceUrlPlaceholder")}
                  aria-label={t("resourceUrlPlaceholder")}
                  aria-invalid={invalid ? true : undefined}
                />
                <OpenUrlIconButton url={item.url} label={t("openLinkInNewTab")} />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="shrink-0"
                  onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label={t("removeResource")}
                >
                  <Trash2 />
                </Button>
              </div>
              <Input
                value={item.label}
                onBlur={onBlur}
                onChange={(event) =>
                  onChange(
                    items.map((rowItem, rowIndex) =>
                      rowIndex === index ? { ...rowItem, label: event.target.value } : rowItem,
                    ),
                  )
                }
                placeholder={t("resourceLabelPlaceholder")}
                aria-label={t("resourceLabelPlaceholder")}
              />
            </>
          );

          if (!canReorder) {
            return (
              <li key={item.key} className="flex flex-col gap-2">
                {row(null)}
              </li>
            );
          }

          return (
            <li key={item.key} className="flex flex-col gap-2">
              <SortableFormItem
                id={item.key}
                dragLabel={t("itemDrag")}
                className="flex flex-col gap-2"
              >
                {row}
              </SortableFormItem>
            </li>
          );
        })}
      </ol>
    ) : null;

  return (
    <div className="flex flex-col gap-2">
      {canReorder ? (
        <SortableVerticalList itemIds={items.map((item) => item.key)} onReorder={handleDragEnd}>
          {list}
        </SortableVerticalList>
      ) : (
        list
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={!canAdd}
        onClick={() => onChange([...items, emptyLessonResource(randomClientId())])}
      >
        <Plus data-icon="inline-start" />
        {t("addResourceLink")}
      </Button>
    </div>
  );
}

function ReadOnlyResources({
  items,
  empty,
}: {
  items: Array<LessonResourceFormValues>;
  empty: string;
}) {
  const visible = items.filter((item) => isValidHttpUrl(item.url.trim()));
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {visible.map((item, index) => (
        <li key={item.key} className="text-sm">
          <span className="text-muted-foreground">{index + 1}. </span>
          <a
            href={item.url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {item.label.trim() || item.url.trim()}
          </a>
        </li>
      ))}
    </ol>
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
            preface={item.preface}
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
