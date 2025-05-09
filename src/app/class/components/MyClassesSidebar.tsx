"use client";

import React from "react";
import { useQueryState } from "nuqs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, School2 } from "lucide-react";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";

function MyClassesContent({
  isLoading,
  isError,
  error,
  data,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: TeacherClassDetail[] | undefined;
}) {
  // Use query state for both class_id and tab.
  const [currentClassId, setCurrentClassId] = useQueryState("class_id");

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Loader2 className="h-8 w-8 animate-spin" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  } else if (isError || error) {
    content = (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <span className="text-destructive">
            Error loading classes. Please refresh the page.
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  } else if (!data || data.length === 0) {
    content = (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <div>Such emptiness is the void.</div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  } else {
    const activeClasses = data.filter((i) => i.classInfo.archived === false);
    content = activeClasses.map((userClass) => {
      const { class_id, class_name, class_year } = userClass.classInfo;
      const isActive = currentClassId === class_id;

      return (
        <SidebarMenuItem key={class_id} className={isActive ? "active" : ""}>
          <SidebarMenuButton asChild>
            <button
              onClick={() => setCurrentClassId(class_id)}
              className={isActive ? "bg-secondary font-bold" : ""}
            >
              <span>
                {class_name} ({class_year})
              </span>
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  }

  return (
    <SidebarGroupContent>
      <SidebarMenu>{content}</SidebarMenu>
    </SidebarGroupContent>
  );
}

export default function MyClassesSidebar() {
  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger>
            <School2 className="mr-2" /> My Classes
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <MyClassesContent
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={data}
          />
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
