import { AlignLeftIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TableOfContentsItem = {
  title: string;
  url: string;
  depth?: number;
};

function useActiveItem(itemIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemIdsKey = itemIds.join("\0");

  useEffect(() => {
    const ids = itemIdsKey.length > 0 ? itemIdsKey.split("\0") : [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0% 0% -80% 0%" },
    );

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [itemIdsKey]);

  return activeId;
}

export function TableOfContents({
  items,
  variant = "list",
  className,
}: {
  items: TableOfContentsItem[];
  variant?: "dropdown" | "list";
  className?: string;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const itemIds = useMemo(() => items.map((item) => item.url.replace("#", "")), [items]);
  const activeHeading = useActiveItem(itemIds);

  if (items.length === 0) {
    return null;
  }

  if (variant === "dropdown") {
    return (
      <div className={className}>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <AlignLeftIcon data-icon="inline-start" />
            {t("onThisPage")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="no-scrollbar max-h-[70svh]">
            <DropdownMenuGroup>
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.url}
                  render={<a href={item.url} />}
                  onClick={() => {
                    setOpen(false);
                  }}
                  data-depth={item.depth}
                  className="data-[depth=3]:pl-6 data-[depth=4]:pl-8"
                >
                  {item.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <nav aria-label={t("onThisPage")} className={cn("flex flex-col gap-2 text-sm", className)}>
      <p className="sticky top-0 bg-background text-xs font-medium text-muted-foreground">
        {t("onThisPage")}
      </p>
      {items.map((item) => (
        <a
          key={item.url}
          href={item.url}
          className="truncate text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:font-medium data-[active=true]:text-foreground data-[depth=3]:pl-4 data-[depth=4]:pl-6"
          data-active={item.url === `#${activeHeading}`}
          data-depth={item.depth}
        >
          {item.title}
        </a>
      ))}
    </nav>
  );
}
