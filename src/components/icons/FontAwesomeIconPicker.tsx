"use client";

import * as React from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/free-solid-svg-icons/faImage";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { resolveIconId } from "./fontawesome-icon-catalog";
import { UI_CATEGORIES } from "./fa-icon-categories";
import iconCategoriesData from "./fontawesome-icon-categories.json";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type IconCategoriesData = {
  metadata: {
    scrape_date: string;
    total_categories: number;
    total_icons: number;
  };
  categories: Record<string, Array<string>>;
};

const categoriesData = iconCategoriesData as IconCategoriesData;

export type FontAwesomeIconPickerProps = {
  value?: IconDefinition | null;
  onChange?: (icon: IconDefinition) => void;

  placeholder?: string;
  disabled?: boolean;

  className?: string;
};

type ParsedIcon = {
  id: string; // e.g. "fas:address-card"
  iconName: string;
  prefix: "fas" | "far";
  iconString: string;
};

type IconLoadState = {
  status: "idle" | "loading" | "loaded" | "error";
  icon: IconDefinition | null;
};

function parseIconClassString(iconString: string): ParsedIcon | null {
  // Parse "fa-classic fa-solid fa-address-card" or "fa-classic fa-regular fa-address-card"
  const parts = iconString.split(" ");
  const solidIndex = parts.indexOf("fa-solid");
  const regularIndex = parts.indexOf("fa-regular");

  let prefix: "fas" | "far" | null = null;
  let iconName: string | null = null;

  if (solidIndex !== -1 && parts[solidIndex + 1]?.startsWith("fa-")) {
    prefix = "fas";
    iconName = parts[solidIndex + 1].replace("fa-", "");
  } else if (regularIndex !== -1 && parts[regularIndex + 1]?.startsWith("fa-")) {
    prefix = "far";
    iconName = parts[regularIndex + 1].replace("fa-", "");
  }

  if (!prefix || !iconName) return null;

  return {
    id: `${prefix}:${iconName}`,
    iconName,
    prefix,
    iconString,
  };
}

function findScrollAreaViewport(root: HTMLElement | null) {
  if (!root) return null;
  return root.querySelector<HTMLDivElement>("[data-slot='scroll-area-viewport']") ?? null;
}

function formatCategoryName(categoryId: string): string {
  const fromUi = UI_CATEGORIES.find((category) => category.id === categoryId);
  if (fromUi) return fromUi.label;
  return categoryId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatIconNameForDisplay(iconName: string): Array<string> {
  return iconName.split("-");
}

// Simple fuzzy search - checks if query characters appear in order in the text
function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 0 };

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) return { match: true, score: 1000 };

  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) return { match: true, score: 500 };

  // Contains query gets medium score
  if (textLower.includes(queryLower)) return { match: true, score: 100 };

  // Fuzzy match: check if all query characters appear in order
  let textIndex = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
    textIndex++;
  }

  // All query characters found in order
  if (queryIndex === queryLower.length) {
    // Score based on how close together the matches are
    const score = maxConsecutive * 10 + (queryLower.length / textLower.length) * 50;
    return { match: true, score };
  }

  return { match: false, score: 0 };
}

type LazyIconCellProps = {
  parsedIcon: ParsedIcon;
  isSelected: boolean;
  onSelect: (icon: IconDefinition) => void;
};

function LazyIconCell({ parsedIcon, isSelected, onSelect }: LazyIconCellProps) {
  const { t } = useTranslation("common");
  const [loadState, setLoadState] = React.useState<IconLoadState>({
    status: "idle",
    icon: null,
  });
  const cellRef = React.useRef<HTMLButtonElement>(null);
  const hasStartedLoadingRef = React.useRef(false);

  React.useEffect(() => {
    const cell = cellRef.current;
    if (!cell || hasStartedLoadingRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasStartedLoadingRef.current) {
          hasStartedLoadingRef.current = true;
          setLoadState({ status: "loading", icon: null });
          resolveIconId(parsedIcon.id)
            .then((icon) => {
              if (icon) {
                setLoadState({ status: "loaded", icon });
              } else {
                setLoadState({ status: "error", icon: null });
              }
            })
            .catch(() => {
              setLoadState({ status: "error", icon: null });
            });
        }
      },
      { rootMargin: "50px" },
    );

    observer.observe(cell);
    return () => observer.disconnect();
  }, [parsedIcon.id]);

  const handleClick = () => {
    if (loadState.status === "loaded" && loadState.icon) {
      onSelect(loadState.icon);
    }
  };

  return (
    <Button
      ref={cellRef}
      type="button"
      variant={isSelected ? "default" : "ghost"}
      size="icon"
      className="h-auto w-full min-w-0 flex flex-col items-center justify-center gap-1 p-2"
      onClick={handleClick}
      disabled={loadState.status !== "loaded"}
    >
      {loadState.status === "loading" || loadState.status === "idle" ? (
        <>
          <FontAwesomeIcon
            icon={faImage}
            className="text-muted-foreground animate-pulse text-2xl"
            fixedWidth
          />
          <span className="text-[8px] text-muted-foreground leading-none">{t("loading")}</span>
        </>
      ) : loadState.status === "error" ? (
        <>
          <div className="text-muted-foreground text-xs">?</div>
          <div className="text-[10px] text-muted-foreground leading-tight w-full min-w-0 text-center">
            {(() => {
              const words = formatIconNameForDisplay(parsedIcon.iconName);
              return words.map((word, idx) => (
                <React.Fragment key={idx}>
                  {word}
                  {idx < words.length - 1 && <br />}
                </React.Fragment>
              ));
            })()}
          </div>
        </>
      ) : loadState.icon ? (
        <>
          <FontAwesomeIcon icon={loadState.icon} className="text-2xl" fixedWidth />
          <div className="text-[10px] leading-tight w-full min-w-0 text-center">
            {(() => {
              const words = formatIconNameForDisplay(parsedIcon.iconName);
              return words.map((word, idx) => (
                <React.Fragment key={idx}>
                  {word}
                  {idx < words.length - 1 && <br />}
                </React.Fragment>
              ));
            })()}
          </div>
        </>
      ) : null}
    </Button>
  );
}

export function FontAwesomeIconPicker({
  value = null,
  onChange,
  placeholder,
  disabled,
  className,
}: FontAwesomeIconPickerProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());
  const triggerLabel = placeholder ?? t("iconPickerPlaceholder");

  // Load ALL icons from all categories (for search)
  const allIcons = React.useMemo(() => {
    const unique = new Map<string, ParsedIcon>();
    for (const categoryId of Object.keys(categoriesData.categories)) {
      const iconStrings = categoriesData.categories[categoryId];
      const parsed = iconStrings
        .map(parseIconClassString)
        .filter((p): p is ParsedIcon => p !== null);
      for (const icon of parsed) {
        if (!unique.has(icon.id)) {
          unique.set(icon.id, icon);
        }
      }
    }
    return Array.from(unique.values());
  }, []);

  // Parse icons from the selected category (when not searching)
  const parsedIcons = React.useMemo(() => {
    if (deferredQuery) return []; // Don't use category icons when searching
    if (!selectedCategory) return [];
    const iconStrings = categoriesData.categories[selectedCategory];
    const parsed = iconStrings.map(parseIconClassString).filter((p): p is ParsedIcon => p !== null);
    // Remove duplicates by id (in case same icon appears multiple times)
    const unique = new Map<string, ParsedIcon>();
    for (const icon of parsed) {
      if (!unique.has(icon.id)) {
        unique.set(icon.id, icon);
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.iconName.localeCompare(b.iconName));
  }, [selectedCategory, deferredQuery]);

  // Filter icons by search query using fuzzy search
  const filteredIcons = React.useMemo(() => {
    if (!deferredQuery) return parsedIcons;

    // Search across all icons when there's a query
    const results = allIcons
      .map((icon) => {
        const match = fuzzyMatch(icon.iconName, deferredQuery);
        return { icon, ...match };
      })
      .filter((result) => result.match)
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .map((result) => result.icon);

    return results;
  }, [allIcons, parsedIcons, deferredQuery]);

  // Prefer curated UI category order, then any remaining scrape categories
  const categories = React.useMemo(() => {
    const available = new Set(Object.keys(categoriesData.categories));
    const ordered = UI_CATEGORIES.map((category) => category.id).filter((id) => available.has(id));
    const extras = [...available].filter((id) => !ordered.includes(id)).sort();
    return [...ordered, ...extras];
  }, []);

  // Vertical icon grid ScrollArea
  const gridScrollAreaRootRef = React.useRef<HTMLDivElement | null>(null);
  const [gridViewportEl, setGridViewportEl] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setGridViewportEl(null);
      return;
    }

    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const viewport = findScrollAreaViewport(gridScrollAreaRootRef.current);
      if (viewport) {
        setGridViewportEl(viewport);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  const cols = 4; // Fixed to 4 columns for larger icons

  const rowSize = 90; // Increased to accommodate larger icon + text
  const rowCount = Math.ceil(filteredIcons.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => gridViewportEl,
    estimateSize: () => rowSize,
    overscan: 10,
  });

  React.useEffect(() => {
    if (!gridViewportEl) return;
    rowVirtualizer.measure();
  }, [gridViewportEl, cols, filteredIcons.length, rowVirtualizer]);

  // Horizontal categories ScrollArea (wheel -> horizontal)
  const catScrollAreaRootRef = React.useRef<HTMLDivElement | null>(null);
  const [catViewportEl, setCatViewportEl] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setCatViewportEl(null);
      return;
    }

    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const viewport = findScrollAreaViewport(catScrollAreaRootRef.current);
      if (viewport) {
        setCatViewportEl(viewport);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  React.useEffect(() => {
    const el = catViewportEl;
    if (!el) return;

    // Convert vertical wheel into horizontal scroll when hovering categories.
    const onWheel = (e: WheelEvent) => {
      // If user is already horizontal scrolling (trackpad) or holding Shift,
      // let the browser handle it.
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      if (Math.abs(e.deltaY) < 1) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel as EventListener);
    };
  }, [catViewportEl]);

  const selectedId = value ? `${value.prefix}:${value.iconName}` : null;

  function handleSelect(icon: IconDefinition) {
    onChange?.(icon);
    setOpen(false);
  }

  function handleCategorySelect(categoryId: string) {
    setSelectedCategory(categoryId);
    setQuery(""); // Clear search when selecting category
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-[280px] justify-start gap-2", className)}
          />
        }
      >
        {value ? (
          <>
            <FontAwesomeIcon icon={value} fixedWidth />
            <span className="truncate">{value.iconName}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{triggerLabel}</span>
        )}
      </DialogTrigger>

      <DialogContent className="w-[600px] h-[600px] p-3 flex flex-col gap-3">
        {/* pr leaves room for the dialog close button */}
        <div className="pr-10">
          <InputGroup>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("iconSearchPlaceholder")}
              aria-label={t("iconSearchPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              {query || selectedCategory ? (
                <InputGroupText>
                  {t("iconSearchResults", { count: filteredIcons.length })}
                </InputGroupText>
              ) : null}
              {query ? (
                <InputGroupButton
                  size="icon-xs"
                  aria-label={t("iconSearchClear")}
                  onClick={() => setQuery("")}
                >
                  <XIcon />
                </InputGroupButton>
              ) : null}
            </InputGroupAddon>
          </InputGroup>
        </div>

        {deferredQuery ? null : (
          <div className="text-xs text-muted-foreground">{t("iconSearchSelectCategory")}</div>
        )}

        <ScrollArea ref={catScrollAreaRootRef} className="w-full rounded-md border">
          <div className="flex w-max gap-2 p-2">
            {categories.map((categoryId) => {
              const active = selectedCategory === categoryId;
              const count = categoriesData.categories[categoryId].length;
              const name = formatCategoryName(categoryId);

              return (
                <Button
                  key={categoryId}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "secondary"}
                  className="shrink-0 gap-2"
                  onClick={() => handleCategorySelect(categoryId)}
                  title={t("iconCategoryCount", { name, count })}
                >
                  <span>{name}</span>
                  <span className="text-xs opacity-70">{count}</span>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="flex-1 border rounded-md overflow-hidden">
          <ScrollArea
            ref={gridScrollAreaRootRef}
            className="h-full w-full"
            onWheelCapture={(e: React.WheelEvent) => {
              // Prevent Dialog from interfering with wheel.
              e.stopPropagation();
            }}
          >
            <div className="relative p-2">
              {!deferredQuery && !selectedCategory ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t("iconSearchSelectCategoryAbove")}
                </div>
              ) : filteredIcons.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {deferredQuery ? t("iconSearchNoMatch") : t("iconCategoryEmpty")}
                </div>
              ) : !gridViewportEl ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t("iconInitializing")}
                </div>
              ) : (
                <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                  {rowVirtualizer.getVirtualItems().map((row) => {
                    const start = row.index * cols;
                    const end = Math.min(start + cols, filteredIcons.length);
                    const slice = filteredIcons.slice(start, end);

                    return (
                      <div
                        key={row.key}
                        className="absolute left-0 top-0 w-full"
                        style={{ transform: `translateY(${row.start}px)` }}
                      >
                        <div
                          className="grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                          }}
                        >
                          {slice.map((parsedIcon) => {
                            const active = parsedIcon.id === selectedId;

                            return (
                              <LazyIconCell
                                key={parsedIcon.id}
                                parsedIcon={parsedIcon}
                                isSelected={active}
                                onSelect={handleSelect}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            {selectedCategory || deferredQuery
              ? t("iconCountShown", { count: filteredIcons.length })
              : "—"}
          </span>
          <span>{selectedCategory ? formatCategoryName(selectedCategory) : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
