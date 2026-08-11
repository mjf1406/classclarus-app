import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Gift,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  ClipboardList,
  ListTodo,
  Mail,
  Megaphone,
  RockingChair,
  SmilePlus,
  Settings2,
  Shield,
  Target,
  UserRound,
  Users,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useClassMemberCounts } from "@/hooks/members/useClassMemberCounts";
import { useCan } from "@/hooks/permissions/useCan";
import type { ClassDoc } from "@/lib/classes/classes";
import { pathFor, type ClassNavTo } from "@/lib/classes/classRoutes";
import type { MemberListRole } from "@/lib/members/members";
import type { ClassPermission } from "@/lib/permissions/classPermissions";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  icon: LucideIcon;
  to: ClassNavTo;
  permission: ClassPermission;
  /** People-role links show a member count when available. */
  countRole?: MemberListRole;
};

export function ClassNavMain({ classDoc }: { classDoc: ClassDoc }) {
  const { t } = useTranslation("classes");
  const { t: tAnnouncements } = useTranslation("announcements");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tTasks } = useTranslation("tasks");
  const { t: tAssignments } = useTranslation("assignments");
  const { t: tPoints } = useTranslation("points");
  const { t: tBehaviors } = useTranslation("behaviors");
  const { t: tRewards } = useTranslation("rewards");
  const { t: tExpectations } = useTranslation("expectations");
  const { t: tRaz } = useTranslation("raz");
  const { t: tAssigners } = useTranslation("assigners");
  const { t: tStudentWork } = useTranslation("studentWork");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isMobile, state, setOpenMobile } = useSidebar();
  const { can, isPending } = useCan();
  const classId = classDoc._id;
  const { data: memberCounts } = useClassMemberCounts(classId);
  const groupsCollapsed = state === "collapsed" && !isMobile;
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [assignersOpen, setAssignersOpen] = useState(false);
  const [studentWorkOpen, setStudentWorkOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const countFor = (role: MemberListRole | undefined): number | null => {
    if (!role) return null;
    return memberCounts?.[role] ?? null;
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Staff (assistant teacher+) see catalog readers under Manage; students/guardians
  // see them in the main area with other personal reads.
  const isStaffNav = can("students:read");
  const expectationsInMainNav = can("expectations:read") && !isStaffNav;
  const expectationsInManageNav = can("expectations:read") && isStaffNav;
  const catalogsInMainNav = can("class:read") && !isStaffNav;
  const catalogsInManageNav = can("class:read") && isStaffNav;

  // Dashboard first, then alphabetize remaining main-area items.
  const topItems: Array<NavItem> = [
    {
      title: t("navDashboard"),
      icon: LayoutDashboard,
      to: "/class/$classId",
      permission: "class:read",
    },
    {
      title: tAnnouncements("nav"),
      icon: Megaphone,
      to: "/class/$classId/announcements",
      permission: "class:read",
    },
    {
      title: tAttendance("nav"),
      icon: ClipboardCheck,
      to: "/class/$classId/attendance",
      permission: "attendance:read",
    },
    ...(catalogsInMainNav
      ? [
          {
            title: tBehaviors("nav"),
            icon: SmilePlus,
            to: "/class/$classId/behaviors" as const,
            permission: "class:read" as const,
          },
        ]
      : []),
    ...(expectationsInMainNav
      ? [
          {
            title: tExpectations("nav"),
            icon: Target,
            to: "/class/$classId/expectations" as const,
            permission: "expectations:read" as const,
          },
        ]
      : []),
    ...(catalogsInMainNav
      ? [
          {
            title: t("navGroups"),
            icon: UsersRound,
            to: "/class/$classId/groups" as const,
            permission: "class:read" as const,
          },
        ]
      : []),
    {
      title: tPoints("nav"),
      icon: Coins,
      to: "/class/$classId/points",
      permission: "points:read",
    },
    {
      title: tRaz("nav"),
      icon: BookOpen,
      to: "/class/$classId/raz",
      permission: "raz:read",
    },
    ...(catalogsInMainNav
      ? [
          {
            title: tRewards("nav"),
            icon: Gift,
            to: "/class/$classId/rewards" as const,
            permission: "class:read" as const,
          },
        ]
      : []),
    {
      title: tTasks("nav"),
      icon: ListTodo,
      to: "/class/$classId/tasks",
      permission: "class:read",
    },
  ];

  const peopleItems: Array<NavItem> = [
    {
      title: t("navTeachers"),
      icon: GraduationCap,
      to: "/class/$classId/teachers",
      permission: "teachers:read",
      countRole: "teacher",
    },
    {
      title: t("navAssistantTeachers"),
      icon: UserRound,
      to: "/class/$classId/assistant-teachers",
      permission: "assistantTeachers:read",
      countRole: "assistant_teacher",
    },
    {
      title: t("navStudents"),
      icon: Users,
      to: "/class/$classId/students",
      permission: "students:read",
      countRole: "student",
    },
    {
      title: t("navGuardians"),
      icon: Shield,
      to: "/class/$classId/guardians",
      permission: "guardians:read",
      countRole: "guardian",
    },
    {
      title: t("navInvitations"),
      icon: Mail,
      to: "/class/$classId/invitations",
      permission: "invitations:read",
    },
  ];

  const assignersItems: Array<NavItem> = [
    {
      title: tAssigners("navSeats"),
      icon: RockingChair,
      to: "/class/$classId/assigners/seats",
      permission: "assigners:read",
    },
  ];

  const studentWorkItems: Array<NavItem> = [
    {
      title: tAssignments("nav"),
      icon: ClipboardList,
      to: "/class/$classId/assignments",
      permission: "class:read",
    },
    {
      title: tStudentWork("navGradeScales"),
      icon: GraduationCap,
      to: "/class/$classId/sw/grade-scales",
      permission: "gradeScales:read",
    },
  ];

  const manageItems: Array<NavItem> = [
    ...(catalogsInManageNav
      ? [
          {
            title: tBehaviors("nav"),
            icon: SmilePlus,
            to: "/class/$classId/behaviors" as const,
            permission: "class:read" as const,
          },
        ]
      : []),
    ...(expectationsInManageNav
      ? [
          {
            title: tExpectations("nav"),
            icon: Target,
            to: "/class/$classId/expectations" as const,
            permission: "expectations:read" as const,
          },
        ]
      : []),
    ...(catalogsInManageNav
      ? [
          {
            title: t("navGroups"),
            icon: UsersRound,
            to: "/class/$classId/groups" as const,
            permission: "class:read" as const,
          },
          {
            title: tRewards("nav"),
            icon: Gift,
            to: "/class/$classId/rewards" as const,
            permission: "class:read" as const,
          },
        ]
      : []),
    {
      title: t("navActivityLog"),
      icon: History,
      to: "/class/$classId/activity",
      permission: "activity:read",
    },
    {
      title: t("navPermissions"),
      icon: KeyRound,
      to: "/class/$classId/permissions",
      permission: "permissions:manage",
    },
    {
      title: t("navSettings"),
      icon: Settings2,
      to: "/class/$classId/settings",
      permission: "class:update",
    },
  ];

  if (isPending) {
    return null;
  }

  const visibleTopItems = topItems.filter((item) => can(item.permission));
  const visiblePeopleItems = peopleItems.filter((item) => can(item.permission));
  const visibleAssignersItems = assignersItems.filter((item) => can(item.permission));
  const visibleStudentWorkItems = studentWorkItems.filter((item) => can(item.permission));
  const visibleManageItems = manageItems.filter((item) => can(item.permission));

  const peopleActive = visiblePeopleItems.some((item) => pathname === pathFor(item.to, classId));
  const assignersActive = visibleAssignersItems.some(
    (item) =>
      pathname === pathFor(item.to, classId) ||
      pathname.startsWith(`${pathFor(item.to, classId)}/`),
  );
  const studentWorkActive = visibleStudentWorkItems.some(
    (item) =>
      pathname === pathFor(item.to, classId) ||
      pathname.startsWith(`${pathFor(item.to, classId)}/`),
  );
  const manageActive = visibleManageItems.some(
    (item) =>
      pathname === pathFor(item.to, classId) ||
      pathname.startsWith(`${pathFor(item.to, classId)}/`),
  );

  return (
    <>
      {visibleTopItems.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>{t("pageTitle")}</SidebarGroupLabel>
          <SidebarMenu>
            {visibleTopItems.map((item) => {
              const href = pathFor(item.to, classId);
              const isActive =
                item.to === "/class/$classId"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    render={<Link to={item.to} params={{ classId }} onClick={closeMobileSidebar} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}

      {visiblePeopleItems.length > 0 ? (
        <SidebarGroup>
          <SidebarMenu>
            {groupsCollapsed ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton tooltip={t("navGroupPeople")} isActive={peopleActive} />
                    }
                  >
                    <Users />
                    <span>{t("navGroupPeople")}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="min-w-56 rounded-lg"
                    align="start"
                    side="right"
                    sideOffset={4}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {t("navGroupPeople")}
                      </DropdownMenuLabel>
                      {visiblePeopleItems.map((item) => {
                        const count = countFor(item.countRole);
                        return (
                          <DropdownMenuItem
                            key={item.to}
                            className="gap-2 p-2"
                            render={
                              <Link
                                to={item.to}
                                params={{ classId }}
                                onClick={closeMobileSidebar}
                              />
                            }
                          >
                            <item.icon />
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            {count !== null ? (
                              <span className="ml-auto tabular-nums text-muted-foreground">
                                {count}
                              </span>
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                open={peopleOpen || peopleActive}
                onOpenChange={setPeopleOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0">
                    <Users />
                    <span>{t("navGroupPeople")}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto transition-transform group-data-[collapsible=icon]:hidden",
                        (peopleOpen || peopleActive) && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visiblePeopleItems.map((item) => {
                        const href = pathFor(item.to, classId);
                        const isActive = pathname === href;
                        const count = countFor(item.countRole);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              isActive={isActive}
                              className={count !== null ? "pr-8" : undefined}
                              render={
                                <Link
                                  to={item.to}
                                  params={{ classId }}
                                  onClick={closeMobileSidebar}
                                />
                              }
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                            {count !== null ? (
                              <SidebarMenuBadge className="top-1">{count}</SidebarMenuBadge>
                            ) : null}
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}

      {visibleAssignersItems.length > 0 ? (
        <SidebarGroup>
          <SidebarMenu>
            {groupsCollapsed ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton
                        tooltip={tAssigners("navGroup")}
                        isActive={assignersActive}
                      />
                    }
                  >
                    <Waypoints />
                    <span>{tAssigners("navGroup")}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="min-w-56 rounded-lg"
                    align="start"
                    side="right"
                    sideOffset={4}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {tAssigners("navGroup")}
                      </DropdownMenuLabel>
                      {visibleAssignersItems.map((item) => (
                        <DropdownMenuItem
                          key={item.to}
                          className="gap-2 p-2"
                          render={
                            <Link to={item.to} params={{ classId }} onClick={closeMobileSidebar} />
                          }
                        >
                          <item.icon />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                open={assignersOpen || assignersActive}
                onOpenChange={setAssignersOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0">
                    <Waypoints />
                    <span>{tAssigners("navGroup")}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto transition-transform group-data-[collapsible=icon]:hidden",
                        (assignersOpen || assignersActive) && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleAssignersItems.map((item) => {
                        const href = pathFor(item.to, classId);
                        const isActive = pathname === href || pathname.startsWith(`${href}/`);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              isActive={isActive}
                              render={
                                <Link
                                  to={item.to}
                                  params={{ classId }}
                                  onClick={closeMobileSidebar}
                                />
                              }
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}

      {visibleStudentWorkItems.length > 0 ? (
        <SidebarGroup>
          <SidebarMenu>
            {groupsCollapsed ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton
                        tooltip={tStudentWork("navGroup")}
                        isActive={studentWorkActive}
                      />
                    }
                  >
                    <GraduationCap />
                    <span>{tStudentWork("navGroup")}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="min-w-56 rounded-lg"
                    align="start"
                    side="right"
                    sideOffset={4}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {tStudentWork("navGroup")}
                      </DropdownMenuLabel>
                      {visibleStudentWorkItems.map((item) => (
                        <DropdownMenuItem
                          key={item.to}
                          className="gap-2 p-2"
                          render={
                            <Link to={item.to} params={{ classId }} onClick={closeMobileSidebar} />
                          }
                        >
                          <item.icon />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                open={studentWorkOpen || studentWorkActive}
                onOpenChange={setStudentWorkOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0">
                    <GraduationCap />
                    <span>{tStudentWork("navGroup")}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto transition-transform group-data-[collapsible=icon]:hidden",
                        (studentWorkOpen || studentWorkActive) && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleStudentWorkItems.map((item) => {
                        const href = pathFor(item.to, classId);
                        const isActive = pathname === href || pathname.startsWith(`${href}/`);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              isActive={isActive}
                              render={
                                <Link
                                  to={item.to}
                                  params={{ classId }}
                                  onClick={closeMobileSidebar}
                                />
                              }
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}

      {visibleManageItems.length > 0 ? (
        <SidebarGroup>
          <SidebarMenu>
            {groupsCollapsed ? (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton tooltip={t("navGroupManage")} isActive={manageActive} />
                    }
                  >
                    <Settings2 />
                    <span>{t("navGroupManage")}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="min-w-56 rounded-lg"
                    align="start"
                    side="right"
                    sideOffset={4}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {t("navGroupManage")}
                      </DropdownMenuLabel>
                      {visibleManageItems.map((item) => (
                        <DropdownMenuItem
                          key={item.to}
                          className="gap-2 p-2"
                          render={
                            <Link to={item.to} params={{ classId }} onClick={closeMobileSidebar} />
                          }
                        >
                          <item.icon />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                open={manageOpen || manageActive}
                onOpenChange={setManageOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0">
                    <Settings2 />
                    <span>{t("navGroupManage")}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto transition-transform group-data-[collapsible=icon]:hidden",
                        (manageOpen || manageActive) && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleManageItems.map((item) => {
                        const href = pathFor(item.to, classId);
                        const isActive = pathname === href || pathname.startsWith(`${href}/`);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              isActive={isActive}
                              render={
                                <Link
                                  to={item.to}
                                  params={{ classId }}
                                  onClick={closeMobileSidebar}
                                />
                              }
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}
    </>
  );
}
