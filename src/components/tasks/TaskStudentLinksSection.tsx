import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCheckAssignmentLinkAccessibility } from "@/hooks/assignments/useCheckAssignmentLinkAccessibility";
import {
  useAddTaskLink,
  useRemoveTaskLink,
  useSetTaskLinkHandedIn,
} from "@/hooks/tasks/useTaskLinks";
import { needsPublicAccessCheck } from "../../../convex/lib/linkAccessibility";
import type { Id } from "../../../convex/_generated/dataModel";

type TaskLink = {
  _id: Id<"taskStudentLinks">;
  url: string;
  label?: string;
  handedIn: boolean;
};

export function TaskStudentLinksSection({
  classId,
  taskId,
  links,
  canEdit,
  studentUserId,
  headingName,
}: {
  classId: Id<"classes">;
  taskId: Id<"tasks">;
  links: TaskLink[];
  canEdit: boolean;
  studentUserId: Id<"users">;
  headingName?: string;
}) {
  const { t } = useTranslation("tasks");
  const addLink = useAddTaskLink();
  const removeLink = useRemoveTaskLink();
  const setHandedIn = useSetTaskLinkHandedIn();
  const { check: checkLinkAccess } = useCheckAssignmentLinkAccessibility();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checkingLinkAccess, setCheckingLinkAccess] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<Id<"taskStudentLinks"> | null>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        {headingName ? `${headingName} · ${t("linksHeading")}` : t("linksHeading")}
      </h2>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link._id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
              >
                {link.label?.trim() || link.url}
                <ExternalLink className="size-3.5" />
              </a>
              <div className="flex items-center gap-3">
                {canEdit ? (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={link.handedIn}
                        onCheckedChange={(checked) => {
                          void setHandedIn.mutateAsync({
                            classId,
                            taskId,
                            linkId: link._id,
                            handedIn: checked === true,
                          });
                        }}
                      />
                      {t("linksHandIn")}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("deleteAction")}
                      onClick={() => setDeletingLinkId(link._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {link.handedIn ? t("linksHandedIn") : t("linksNotHandedIn")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (checkingLinkAccess || addLink.isPending) return;
            setLinkError(null);
            const trimmedUrl = url.trim();
            if (!trimmedUrl) {
              setLinkError(t("linksUrlRequired"));
              return;
            }
            try {
              const parsed = new URL(trimmedUrl);
              if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                setLinkError(t("linksUrlInvalid"));
                return;
              }
            } catch {
              setLinkError(t("linksUrlInvalid"));
              return;
            }
            void (async () => {
              if (needsPublicAccessCheck(trimmedUrl)) {
                setCheckingLinkAccess(true);
                try {
                  const result = await checkLinkAccess(trimmedUrl);
                  if (result.access === "private") {
                    setLinkError(
                      result.provider === "canva"
                        ? t("linksAccessPrivateCanva")
                        : t("linksAccessPrivateGoogle"),
                    );
                    return;
                  }
                  if (result.access === "unknown") {
                    setLinkError(t("linksAccessUnverified"));
                    return;
                  }
                } catch (error: unknown) {
                  setLinkError(
                    error instanceof Error ? error.message : t("linksAccessCheckFailed"),
                  );
                  return;
                } finally {
                  setCheckingLinkAccess(false);
                }
              }
              try {
                await addLink.mutateAsync({
                  classId,
                  taskId,
                  url: trimmedUrl,
                  label: label.trim() || undefined,
                  studentUserId,
                });
                setUrl("");
                setLabel("");
                window.setTimeout(() => linkUrlInputRef.current?.focus(), 0);
              } catch (error: unknown) {
                setLinkError(error instanceof Error ? error.message : t("linkSaveFailed"));
              }
            })();
          }}
        >
          <Field>
            <FieldLabel htmlFor="task-link-url">{t("linksUrlLabel")}</FieldLabel>
            <Input
              ref={linkUrlInputRef}
              id="task-link-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              disabled={checkingLinkAccess || addLink.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-link-label">{t("linksLabelLabel")}</FieldLabel>
            <Input
              id="task-link-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t("linksLabelOptional")}
              disabled={checkingLinkAccess || addLink.isPending}
            />
          </Field>
          {linkError ? <FieldError>{linkError}</FieldError> : null}
          <Button
            type="submit"
            className="w-fit"
            disabled={checkingLinkAccess || addLink.isPending}
          >
            <Plus className="size-4" />
            {checkingLinkAccess ? t("linksAccessChecking") : t("linksAdd")}
          </Button>
        </form>
      ) : null}

      <DeleteNamedCredenza
        open={deletingLinkId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLinkId(null);
        }}
        title={t("linkDeleteConfirmTitle")}
        description={t("linkDeleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          if (!deletingLinkId) return;
          await removeLink.mutateAsync({ classId, taskId, linkId: deletingLinkId });
          setDeletingLinkId(null);
        }}
      />
    </section>
  );
}
