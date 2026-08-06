import type * as React from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/brand/Logo";
import { NavUser } from "@/components/navigation/NavUser";
import { AdminNavMain } from "@/components/navigation/admin-sidebar/AdminNavMain";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

type AdminAppSidebarProps = React.ComponentProps<typeof Sidebar>;

export function AdminAppSidebar(props: AdminAppSidebarProps) {
  const { t } = useTranslation("common");

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={t("admin")} render={<Link to="/" />}>
              <Icon className="size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{t("admin")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AdminNavMain />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
