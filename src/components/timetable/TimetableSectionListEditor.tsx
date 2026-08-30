import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  rowFocusKeyProps,
  rowFocusTargetProps,
  usePendingRowFocus,
} from "@/hooks/usePendingRowFocus";
import { randomClientId } from "@/lib/optimistic";
import { extractHashtags, normalizeTag } from "@/lib/timetable/sectionItems";
import {
  emptySectionItem,
  type SectionItemFormValues,
  type TimetableTag,
} from "@/lib/timetable/timetable";

type TimetableSectionListEditorProps<T extends SectionItemFormValues = SectionItemFormValues> = {
  items: Array<T>;
  onChange: (items: Array<T>) => void;
  tags: ReadonlyArray<TimetableTag>;
  placeholder?: string;
  disabled?: boolean;
  renderControl?: (item: T, index: number) => ReactNode | null;
  renderRowActions?: (item: T, index: number) => ReactNode;
  renderAdd?: (helpers: { addItem: () => void }) => ReactNode;
};

function activeHashtagQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const match = /#([A-Za-z0-9_][A-Za-z0-9_-]*)$/.exec(before);
  return match?.[1] ?? null;
}

export function TimetableSectionListEditor<
  T extends SectionItemFormValues = SectionItemFormValues,
>({
  items,
  onChange,
  tags,
  placeholder,
  disabled = false,
  renderControl,
  renderRowActions,
  renderAdd,
}: TimetableSectionListEditorProps<T>) {
  const { t } = useTranslation("timetable");
  const { queueRowFocus } = usePendingRowFocus();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const addItem = () => {
    const key = randomClientId();
    onChange([...items, emptySectionItem(key) as unknown as T]);
    queueRowFocus(key);
  };

  const suggestions = useMemo(() => {
    const needle = normalizeTag(query);
    return tags
      .filter((tag) => tag.tag.startsWith(needle) || tag.display.toLowerCase().startsWith(needle))
      .slice(0, 8);
  }, [query, tags]);

  const updateItem = (index: number, text: string, caret?: number) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, text, tags: extractHashtags(text) } : item,
    );
    onChange(next);
    const prefix = caret === undefined ? null : activeHashtagQuery(text, caret);
    if (prefix !== null) {
      setOpenIndex(index);
      setQuery(prefix);
    } else {
      setOpenIndex(null);
      setQuery("");
    }
  };

  const applySuggestion = (index: number, display: string) => {
    const item = items[index];
    if (!item) return;
    const replaced = item.text.replace(/#([A-Za-z0-9_][A-Za-z0-9_-]*)$/, `#${display} `);
    updateItem(index, replaced);
    setOpenIndex(null);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-2" {...rowFocusKeyProps(item.key)}>
            <div className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-sm text-muted-foreground">
                {index + 1}.
              </span>
              <div className="relative min-w-0 flex-1">
                {renderControl?.(item, index) ?? (
                  <>
                    <Input
                      {...rowFocusTargetProps()}
                      value={item.text}
                      disabled={disabled}
                      placeholder={placeholder}
                      onChange={(event) =>
                        updateItem(
                          index,
                          event.target.value,
                          event.target.selectionStart ?? undefined,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        if (event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        if (openIndex === index && suggestions[0]) {
                          applySuggestion(index, suggestions[0].display);
                        }
                      }}
                    />
                    {openIndex === index && suggestions.length > 0 ? (
                      <div className="absolute z-20 mt-1 flex w-full flex-col rounded-md border bg-popover p-1 shadow-md">
                        {suggestions.map((tag) => (
                          <Button
                            key={tag.tag}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applySuggestion(index, tag.display)}
                          >
                            #{tag.display}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              {disabled ? null : (
                <>
                  {renderRowActions?.(item, index)}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="shrink-0"
                    onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={t("removeItem")}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      {disabled ? null : renderAdd ? (
        renderAdd({ addItem })
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={addItem}
        >
          <Plus data-icon="inline-start" />
          {t("addItem")}
        </Button>
      )}
    </div>
  );
}
