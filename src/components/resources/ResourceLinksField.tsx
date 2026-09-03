import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { randomClientId } from "@/lib/optimistic";
import { MAX_TASK_RESOURCES, isValidHttpUrl } from "../../../convex/lib/tasks/taskSchema";

export type ResourceLinkFormValue = {
  key: string;
  url: string;
  label: string;
};

function emptyResourceLink(): ResourceLinkFormValue {
  return { key: randomClientId(), url: "", label: "" };
}

export function ResourceLinksField({
  items,
  onChange,
}: {
  items: ResourceLinkFormValue[];
  onChange: (items: ResourceLinkFormValue[]) => void;
}) {
  const { t } = useTranslation("tasks");
  const canAdd = items.length < MAX_TASK_RESOURCES;

  return (
    <Field>
      <FieldLabel>{t("resourcesLabel")}</FieldLabel>
      <FieldDescription>{t("resourcesDescription")}</FieldDescription>
      <div className="flex flex-col gap-2">
        {items.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    value={item.url}
                    onChange={(event) =>
                      onChange(
                        items.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, url: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder={t("resourceUrlPlaceholder")}
                    aria-label={t("resourceUrlPlaceholder")}
                  />
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
                  onChange={(event) =>
                    onChange(
                      items.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, label: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder={t("resourceLabelPlaceholder")}
                  aria-label={t("resourceLabelPlaceholder")}
                />
              </li>
            ))}
          </ol>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={!canAdd}
          onClick={() => onChange([...items, emptyResourceLink()])}
        >
          <Plus data-icon="inline-start" />
          {t("addResourceLink")}
        </Button>
      </div>
    </Field>
  );
}

export function ReadOnlyResourceLinks({
  items,
}: {
  items: Array<{ key: string; url: string; label?: string }>;
}) {
  const { t } = useTranslation("tasks");
  const visible = items.filter((item) => isValidHttpUrl(item.url.trim()));
  if (visible.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{t("resourcesLabel")}</h2>
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
              {item.label?.trim() || item.url.trim()}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
