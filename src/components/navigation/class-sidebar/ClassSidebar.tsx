import type * as React from "react";

import { NavUser } from "@/components/navigation/NavUser";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ClassDoc } from "@/lib/classes/classes";
import { ClassSwitcher } from "./ClassSwitcher";
import { ClassNavMain } from "./ClassMainNavLinks";

type ClassAppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  classDoc: ClassDoc;
};

export function ClassAppSidebar({ classDoc, ...props }: ClassAppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ClassSwitcher currentClass={classDoc} />
      </SidebarHeader>
      <SidebarContent>
        <ClassNavMain classDoc={classDoc} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
