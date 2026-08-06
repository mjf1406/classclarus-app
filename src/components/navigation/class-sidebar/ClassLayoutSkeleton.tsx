import type { ComponentProps } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuSkeleton,
  SidebarRail,
} from "@/components/ui/sidebar";

/** Sidebar chrome placeholder while the class document is loading. */
export function ClassSidebarSkeleton(props: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {Array.from({ length: 5 }, (_, i) => (
              <SidebarMenuSkeleton key={i} showIcon />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function ClassBreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-3" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
