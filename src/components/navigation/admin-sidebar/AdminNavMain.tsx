import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquareIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { useIsFeedbackAdmin } from "@/hooks/feedback/useIsFeedbackAdmin";
import { isSelfHosted } from "@/lib/selfHosted";

type AdminNavItem = {
  title: string;
  icon: LucideIcon;
  to: "/admin" | "/admin/feedback";
  exact?: boolean;
};

export function AdminNavMain() {
  const { t } = useTranslation(["admin", "feedback", "common"]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  const selfHosted = isSelfHosted();
  const { isAdmin: isSelfHostAdmin } = useIsAppAdmin();
  const { isAdmin: isFeedbackAdmin } = useIsFeedbackAdmin();

  const items: AdminNavItem[] = [];
  if (selfHosted && isSelfHostAdmin) {
    items.push({
      title: t("admin:usersNav"),
      icon: UsersIcon,
      to: "/admin",
      exact: true,
    });
  }
  if (!selfHosted && isFeedbackAdmin) {
    items.push({
      title: t("feedback:adminNav"),
      icon: MessageSquareIcon,
      to: "/admin/feedback",
    });
  }

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("common:admin")}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.to || pathname === `${item.to}/`
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                render={<Link to={item.to} onClick={closeMobileSidebar} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
