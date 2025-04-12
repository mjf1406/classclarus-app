"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ClassByIdOptions,
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "../api/queryOptions";
import { CircleX, Loader2 } from "lucide-react";
// Import shadcn Tabs components
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQueryState } from "nuqs";
import "src/lib/string.extensions.ts";

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
    <div className="px-5 py-3">
      <h1 className="mb-2 text-3xl font-bold">
        {teacherClassData?.classInfo?.class_name} (
        {teacherClassData?.classInfo?.class_year})
      </h1>
      <Tabs value={tabParam} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="assigners">Assigners</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="expectations">Expectations</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="random-event">Random Event</TabsTrigger>
          <TabsTrigger value="randomizer">Randomizer</TabsTrigger>
          <TabsTrigger value="silent-chat">Silent Chat</TabsTrigger>
          <TabsTrigger value="shuffler">Shuffler</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="assigners">
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
          <p>This is the dashboard content.</p>
        </TabsContent>
        <TabsContent value="expectations">
          <p>This is the expectations content.</p>
        </TabsContent>
        <TabsContent value="points">
          <p>This is the points content.</p>
        </TabsContent>
        <TabsContent value="random-event">
          <p>
            Randomly choose a daily event from default options or ones
            you&apos;ve added.
          </p>
        </TabsContent>
        <TabsContent value="randomizer">
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
        <TabsContent value="silent-chat">
          <p>
            Communicate silently with a student by passing your phone between
            each other.
          </p>
        </TabsContent>
        <TabsContent value="shuffler">
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
          <p>This is the tasks content.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
