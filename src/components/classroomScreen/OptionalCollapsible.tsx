import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OptionalCollapsibleProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function OptionalCollapsible({
  title,
  children,
  className,
  contentClassName,
}: OptionalCollapsibleProps) {
  return (
    <Collapsible defaultOpen={false} className={className}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">
        {title}
        <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("grid gap-4 pt-4", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
