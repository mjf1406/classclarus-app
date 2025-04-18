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
      <h1 className="bg-muted -mt-7 mb-2 flex items-center justify-between pt-8 pr-4 pb-3 pl-3 text-3xl font-bold md:pt-5 md:pl-10">
        <div>
          {teacherClassData?.classInfo?.class_name} (
          {teacherClassData?.classInfo?.class_year})
        </div>
        <ClassActionMenu
          classId={teacherClassData?.classInfo.class_id ?? ""}
          className="dark:bg-background dark:hover:bg-accent dark:text-white"
        />
      </h1>
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
            className="border-b-none rounded-b-none data-[state=active]:shadow-none"
            value="shuffler"
          >
            <Shuffle />
            <span className="hidden lg:inline">Shuffler</span>
          </TabsTrigger>
          <TabsTrigger
            className="border-b-none rounded-b-none data-[state=active]:shadow-none sm:px-0 md:px-2"
            value="tasks"
          >
            <ListChecks />
            <span className="hidden lg:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger
            className="border-b-none rounded-b-none data-[state=active]:shadow-none sm:px-0 md:px-2"
            value="ufli"
          >
            <NotebookText />
            <span className="hidden lg:inline">UFLI</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <div className="px-5">
          <TabsContent value="assigners">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Assigners
            </h2>
            <Tabs defaultValue={"random"}>
              <TabsList className="mb-4">
                <TabsTrigger value="random">Random</TabsTrigger>
                <TabsTrigger value="round-robin">Round Robin</TabsTrigger>
                <TabsTrigger value="seats">Seats</TabsTrigger>
              </TabsList>
              <TabsContent value="random">
                <p>This is the random assigner content.</p>
              </TabsContent>
              <TabsContent value="round-robin">
                <p>This is the round robin assigner content.</p>
              </TabsContent>
              <TabsContent value="seats">
                <p>This is the seats assigner content.</p>
              </TabsContent>
            </Tabs>
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
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Random Event
            </h2>
            <p>
              Randomly choose a daily event from default options or ones
              you&apos;ve added.
            </p>
          </TabsContent>
          <TabsContent value="randomizer">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Randomizer
            </h2>
            <p>
              Randomly select a group, team, or student for activities or
              assignments.
            </p>
            <br />
            <Tabs defaultValue={"group"}>
              <TabsList className="mb-4">
                <TabsTrigger value="group">Group</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
              </TabsList>
              <TabsContent value="group">
                <p>This is the group randomizer.</p>
              </TabsContent>
              <TabsContent value="team">
                <p>This is the team randomizer.</p>
              </TabsContent>
              <TabsContent value="student">
                <p>This is the student randomizer.</p>
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="raz">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              RAZ Plus
            </h2>
            <p>
              Track your student progress through RAZ Kids with frequency
              reminders all in accordance with RAZ Plus&apos; guidelines.
            </p>
            <br />
            <RazTab classId={classId} />
          </TabsContent>
          <TabsContent value="silent-chat">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Silent Chat
            </h2>
            <p>
              Communicate silently with a student by passing your phone between
              each other.
            </p>
          </TabsContent>
          <TabsContent value="shuffler">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Shuffler
            </h2>
            <p>
              Randomly order your groups, teams, or students, ensuring everyone
              gets a chance to be first and last before any repeats.
            </p>
            <br />
            <Tabs defaultValue={"group"}>
              <TabsList className="mb-4">
                <TabsTrigger value="group">Group</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="student">Student</TabsTrigger>
              </TabsList>
              <TabsContent value="group">
                <p>This is the group shuffler.</p>
              </TabsContent>
              <TabsContent value="team">
                <p>This is the team shuffler.</p>
              </TabsContent>
              <TabsContent value="student">
                <p>This is the student shuffler.</p>
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="tasks">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">
              Tasks
            </h2>
          </TabsContent>
          <TabsContent value="ufli">
            <h2 className="mb-2 block text-xl font-semibold lg:hidden">UFLI</h2>
            <p>Track your students reading speed using UFLI assessments.</p>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
