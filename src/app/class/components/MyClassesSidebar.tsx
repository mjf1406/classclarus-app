"use client";

import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
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
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const classId = searchParams.get("class_id");
  const tab = searchParams.get("tab");

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
          Error loading classes. Please refresh the page.
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
    content = data.map((userClass) => {
      const { class_id, class_name, class_year } = userClass.classInfo;
      const isActive = classId === class_id;

      return (
        <SidebarMenuItem key={class_id} className={isActive ? "active" : ""}>
          <SidebarMenuButton asChild>
            <Link
              href={`/class?class_id=${class_id}&tab=${tab ?? "points"}`}
              className={isActive ? "bg-secondary font-bold" : ""}
            >
              <span>
                {class_name} ({class_year})
              </span>
            </Link>
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
