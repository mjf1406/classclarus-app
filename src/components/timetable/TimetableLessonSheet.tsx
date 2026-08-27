import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

import { AssignmentInstructionsEditor } from "@/components/assignments/AssignmentInstructionsEditor";
import { AnnouncementBody } from "@/components/announcements/AnnouncementBody";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignments } from "@/hooks/assignments/useAssignments";
import { useTasks } from "@/hooks/tasks/useTasks";
import { useUpsertLesson, type UpsertLessonArgs } from "@/hooks/timetable/useTimetableMutations";
import {
  EMPTY_NOTES_JSON,
  type LessonLinkFormValues,
  type TimetableLesson,
  type TimetableLessonLink,
} from "@/lib/timetable/timetable";
import { randomClientId } from "@/lib/optimistic";
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
  const { t } = useTranslation("timetable");
  const upsertLesson = useUpsertLesson();
  const { data: tasks } = useTasks(classId);
  const { data: assignments } = useAssignments(classId);

  const [notesJson, setNotesJson] = useState(EMPTY_NOTES_JSON);
  const [complete, setComplete] = useState(false);
  const [links, setLinks] = useState<Array<LessonLinkFormValues>>([]);
  const [linkKind, setLinkKind] = useState<"url" | "assignment" | "task">("url");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkAssignmentId, setLinkAssignmentId] = useState<string>("");
  const [linkTaskId, setLinkTaskId] = useState<string>("");

  useEffect(() => {
    if (!lesson) return;
    setNotesJson(lesson.notesJson ?? EMPTY_NOTES_JSON);
    setComplete(lesson.complete);
    setLinks(lesson.links.map((l: TimetableLessonLink) => ({ ...l })));
  }, [lesson]);

  if (!lesson) return null;

  const subject = lesson.subject;

  const addLink = () => {
    const key = randomClientId();
    if (linkKind === "url") {
      if (!linkUrl.trim()) return;
      setLinks((prev) => [
        ...prev,
        { key, kind: "url", label: linkLabel.trim() || undefined, url: linkUrl.trim() },
      ]);
      setLinkLabel("");
      setLinkUrl("");
      return;
    }
    if (linkKind === "assignment" && linkAssignmentId) {
      const assignment = assignments?.find((a) => a._id === linkAssignmentId);
      setLinks((prev) => [
        ...prev,
        {
          key,
          kind: "assignment",
          assignmentId: linkAssignmentId as Id<"assignments">,
          label: linkLabel.trim() || assignment?.name,
        },
      ]);
      setLinkLabel("");
      setLinkAssignmentId("");
      return;
    }
    if (linkKind === "task" && linkTaskId) {
      const task = tasks?.find((item) => item._id === linkTaskId);
      setLinks((prev) => [
        ...prev,
        {
          key,
          kind: "task",
          taskId: linkTaskId as Id<"tasks">,
          label: linkLabel.trim() || task?.name,
        },
      ]);
      setLinkLabel("");
      setLinkTaskId("");
    }
  };

  const save = async () => {
    const args: UpsertLessonArgs = {
      classId,
      termId,
      slotId: lesson.slotId,
      subjectId: lesson.subjectId,
      year,
      weekNumber,
      notesJson,
      complete,
      links,
      lessonId: lesson._id,
    };
    await upsertLesson.mutateAsync(args);
    onOpenChange(false);
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-lg">
        <CredenzaHeader>
          <CredenzaTitle>{subject.name}</CredenzaTitle>
          <CredenzaDescription>
            {canManage ? t("lessonEditDescription") : t("lessonViewDescription")}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody className="space-y-4">
          {canManage ? (
            <>
              <AssignmentInstructionsEditor value={notesJson} onChange={setNotesJson} />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lesson-complete"
                  checked={complete}
                  onCheckedChange={(checked) => setComplete(checked === true)}
                />
                <Label htmlFor="lesson-complete">{t("markComplete")}</Label>
              </div>
            </>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <AnnouncementBody bodyJson={notesJson} />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("lessonLinks")}</Label>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.key} className="flex items-center gap-2 text-sm">
                  <LessonLinkRow classId={classId} link={link} />
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setLinks((prev) => prev.filter((l) => l.key !== link.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
              {links.length === 0 ? (
                <li className="text-sm text-muted-foreground">{t("noLinks")}</li>
              ) : null}
            </ul>

            {canManage ? (
              <div className="rounded-md border p-3 space-y-2">
                <Select
                  value={linkKind}
                  onValueChange={(v) => v && setLinkKind(v as typeof linkKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">{t("linkKindUrl")}</SelectItem>
                    <SelectItem value="assignment">{t("linkKindAssignment")}</SelectItem>
                    <SelectItem value="task">{t("linkKindTask")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t("linkLabelPlaceholder")}
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                />
                {linkKind === "url" ? (
                  <Input
                    placeholder="https://"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                ) : null}
                {linkKind === "assignment" ? (
                  <Select
                    value={linkAssignmentId}
                    onValueChange={(v) => setLinkAssignmentId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("pickAssignment")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(assignments ?? []).map((a) => (
                        <SelectItem key={a._id} value={a._id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {linkKind === "task" ? (
                  <Select value={linkTaskId} onValueChange={(v) => setLinkTaskId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("pickTask")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(tasks ?? []).map((task) => (
                        <SelectItem key={task._id} value={task._id}>
                          {task.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Button type="button" variant="secondary" size="sm" onClick={addLink}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("addLink")}
                </Button>
              </div>
            ) : null}
          </div>
        </CredenzaBody>
        <CredenzaFooter>
          <CredenzaClose render={<Button variant="outline" />}>
            {canManage ? t("cancel") : t("close")}
          </CredenzaClose>
          {canManage ? (
            <Button onClick={() => void save()} disabled={upsertLesson.isPending}>
              {t("saveAction")}
            </Button>
          ) : null}
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

function LessonLinkRow({ classId, link }: { classId: Id<"classes">; link: LessonLinkFormValues }) {
  const label = link.label ?? link.url ?? link.kind;

  if (link.kind === "url" && link.url) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline truncate flex-1"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    );
  }

  if (link.kind === "assignment" && link.assignmentId) {
    return (
      <Link
        to="/class/$classId/assignments/$assignmentId"
        params={{ classId, assignmentId: link.assignmentId }}
        className="inline-flex items-center gap-1 text-primary hover:underline truncate flex-1"
      >
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  if (link.kind === "task" && link.taskId) {
    return (
      <Link
        to="/class/$classId/tasks/$taskId"
        params={{ classId, taskId: link.taskId }}
        className="inline-flex items-center gap-1 text-primary hover:underline truncate flex-1"
      >
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return <span className="truncate flex-1">{label}</span>;
}
