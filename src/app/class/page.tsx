"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ClassByIdOptions,
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "../api/queryOptions";
import {
  BookOpenText,
  CircleX,
  Coins,
  Dice5,
  ExternalLink,
  Goal,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MapPin,
  NotebookText,
  Shuffle,
  Signpost,
} from "lucide-react";
// Import shadcn Tabs components
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQueryState } from "nuqs";
import "src/lib/string.extensions.ts";
import PointsTab from "./components/dashboard/TabPoints";
import ClassActionMenu from "./components/ClassActionMenu";
import RazTab from "./components/raz/RazTab";
import Link from "next/link";
import AssignersTab from "./components/assigners/AssignersTabs";
import CreateAssignerDialog from "./components/assigners/CreateAssignerDialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import RandomizersTab from "./components/randomizers/RandomizerTabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import GradebookTab from "./components/gradebook/GradebookTab";
import RandomEventsTab from "./components/random-events/RandomEventsTab";

function useIsMdUp() {
  const [isMdUp, setIsMdUp] = React.useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsMdUp(window.innerWidth >= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMdUp;
}

export default function ClassPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("class_id");
  const tabParam = searchParams.get("tab") ?? "points";
  const [tab, setTab] = useQueryState("tab");
  const isMdUp = useIsMdUp();

  const widthCalc = isMdUp
    ? "calc(100dvw - var(--sidebar-width) - 20px)"
    : "calc(100dvw - 15px)";

  const {
    data: teacherClassesData,
    isLoading: teacherClassesDataLoading,
    isError: teacherClassesDataIsError,
    error: teacherClassesDataError,
  } = useQuery<TeacherClassDetail[]>(TeacherClassesOptions);
  const teacherClassData = teacherClassesData?.find(
    (i) => i.classInfo.class_id === classId,
  );
  const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

  React.useEffect(() => {
    if (teacherClassData) {
      const newTitle = `${
        teacherClassData?.classInfo.class_name
      } | ${tab?.toTitleCase() ?? tabParam.toTitleCase()}`;
      document.title = newTitle;
    }
  }, [teacherClassData, tab, tabParam]);
  if (!classId) {
    return (
      <div
        className="bg-destructive min-h-screen w-screen px-5 py-3"
        style={{ width: widthCalc }}
      >
        <h1 className="mb-2 flex flex-row items-center gap-2 text-3xl font-bold">
          <CircleX size={36} /> No Class ID Provided
        </h1>
        <p className="max-w-lg">Please select a class in the sidebar.</p>
        <br />
        <p className="max-w-lg">
          There was no <span className="italic">class_id</span> in the URL. If
          someone sent you this URL, let them know that they need to share the
          entire URL and that they must not exclude the parts after the question
          mark (?).
        </p>
      </div>
    );
  }

  if (isLoading || teacherClassesDataLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (error || teacherClassesDataError || teacherClassesDataIsError) {
    return (
      <div className="px-5 py-3 text-red-500">
        {error instanceof Error ? error.message : "An error occurred"}
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="bg-muted flex items-center justify-between pt-4 pr-4 pb-3 text-3xl font-bold">
        <div className="flex items-center justify-center gap-10">
          <SidebarTrigger className="pl-5" />
          <div>
            {teacherClassData?.classInfo?.class_name} (
            {teacherClassData?.classInfo?.class_year})
          </div>
        </div>
        <ClassActionMenu
          classId={teacherClassData?.classInfo.class_id ?? ""}
          className="dark:bg-background dark:hover:bg-accent dark:text-white"
        />
      </h1>
      <TooltipProvider>
        <Tabs value={tabParam} onValueChange={setTab}>
          <TabsList className="-mt-2 mb-3 w-full grow-0 rounded-none pb-0 pl-2 md:pl-10">
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="assigners"
            >
              <Signpost />
              <span className="hidden lg:inline">Assigners</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="dashboard"
            >
              <LayoutDashboard />
              <span className="hidden lg:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="expectations"
            >
              <Goal />
              <span className="hidden lg:inline">Expectations</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="points"
            >
              <Coins />
              <span className="hidden lg:inline">Points</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="random-event"
            >
              <MapPin />
              <span className="hidden lg:inline">Random Event</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="randomizer"
            >
              <Dice5 />
              <span className="hidden lg:inline">Randomizer</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none"
              value="raz"
            >
              <BookOpenText />
              <span className="hidden lg:inline">RAZ Plus</span>
            </TabsTrigger>
            {/* <TabsTrigger
            className="border-b-none rounded-b-none data-[state=active]:shadow-none"
            value="silent-chat"
          >
            <MessageCircle />
            <span className="hidden lg:inline">Silent Chat</span>
          </TabsTrigger> */}
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none sm:px-0 md:px-2"
              value="tasks"
            >
              <ListChecks />
              <span className="hidden lg:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger
              className="border-b-none rounded-b-none data-[state=active]:shadow-none sm:px-0 md:px-2"
              value="gradebook"
            >
              <NotebookText />
              <span className="hidden lg:inline">Gradebook</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="px-5">
            <TabsContent value="assigners">
              <div className="flex items-center justify-between">
                <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                  Assigners
                </h2>
                <CreateAssignerDialog />
              </div>
              <AssignersTab classId={classId} />
            </TabsContent>

            <TabsContent value="dashboard">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Dashboard
              </h2>
              <PointsTab classId={classId} />
            </TabsContent>
            <TabsContent value="expectations">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Expectations
              </h2>
            </TabsContent>
            <TabsContent value="points">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Points
              </h2>
            </TabsContent>
            <TabsContent value="random-event">
              <RandomEventsTab classId={classId} />
            </TabsContent>
            <TabsContent value="randomizer">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Randomizer
              </h2>
              <p>
                Randomly select from groups, teams, or students with or without
                replacement.
              </p>
              <br />
              <RandomizersTab classId={classId} />
            </TabsContent>
            <TabsContent value="raz">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                RAZ Plus
              </h2>
              <p className="max-w-3xl">
                Track your students&apos; progress through RAZ Kids with
                frequency reminders all in accordance with{" "}
                <Link
                  href="https://www.raz-plus.com/learninga-z-levels/assessing-a-students-level/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 underline"
                >
                  <span>RAZ Plus&apos; guidelines</span>
                  <ExternalLink size={16} />
                </Link>
                . Currently, we do not determine whether a student is{" "}
                <span className="italic">
                  &quot;...not progressing at the expected rate...&quot;
                </span>
                , so we make no recommendations about testing frequency based on
                whether a student is falling behind their grade level.
              </p>
              <br />
              <RazTab classId={classId} />
            </TabsContent>
            <TabsContent value="silent-chat">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Silent Chat
              </h2>
              <p>
                Communicate silently with a student by passing your phone
                between each other.
              </p>
            </TabsContent>
            <TabsContent value="tasks">
              <h2 className="mb-2 block text-xl font-semibold lg:hidden">
                Tasks
              </h2>
            </TabsContent>
            <TabsContent value="gradebook">
              <GradebookTab classId={classId} />
            </TabsContent>
          </div>
        </Tabs>
      </TooltipProvider>
    </div>
  );
}
