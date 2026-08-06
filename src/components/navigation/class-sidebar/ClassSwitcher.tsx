import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronsUpDown, Plus, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ClassRoleIconBadge } from "@/components/badges/ClassRoleBadges";
import { ClassFormCredenza } from "@/components/classes/ClassFormCredenza";
import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import { useCreateClass } from "@/hooks/classes/useCreateClass";
import { useActiveClasses } from "@/hooks/classes/useClasses";
import type { ClassDoc } from "@/lib/classes/classes";
import type { ClassFormValues } from "@/lib/classes/classFormSchema";
import { classRouteFromPathname } from "@/lib/classes/classRoutes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";

type ClassSwitcherProps = {
  currentClass: ClassDoc;
};

export function ClassSwitcher({ currentClass }: ClassSwitcherProps) {
  const { t } = useTranslation("classes");
  const { isMobile, setOpenMobile } = useSidebar();
  const { role } = useClassPermissionsContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: classes = [] } = useActiveClasses();
  const createClass = useCreateClass();
  const [createOpen, setCreateOpen] = useState(false);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleCreate = async (values: ClassFormValues) => {
    const created = await createClass.mutateAsync({
      name: values.name,
      year: values.year,
      description: values.description,
      icon: values.icon,
    });
    closeMobileSidebar();
    void navigate({
      to: "/class/$classId",
      params: { classId: created._id },
    });
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                />
              }
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                {currentClass.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentClass.name}</span>
                <span className="truncate text-xs text-muted-foreground">{currentClass.year}</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                {role ? <ClassRoleIconBadge role={role} /> : null}
                <ChevronsUpDown />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t("switchClasses")}
                </DropdownMenuLabel>
                {classes.map((classDoc) => (
                  <DropdownMenuItem
                    key={classDoc._id}
                    className="gap-2 p-2"
                    onClick={() => {
                      closeMobileSidebar();
                      void navigate({
                        to: classRouteFromPathname(pathname, currentClass._id),
                        params: { classId: classDoc._id },
                      });
                    }}
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border text-xs font-medium">
                      {classDoc.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate">{classDoc.name}</span>
                    <ClassRoleIconBadge role={classDoc.role} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onClick={() => setCreateOpen(true)}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">{t("createClass")}</div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => {
                  closeMobileSidebar();
                  void navigate({ to: "/join" });
                }}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <UserPlus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">{t("join")}</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <ClassFormCredenza
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />
    </>
  );
}
